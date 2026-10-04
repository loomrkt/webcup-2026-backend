import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { User } from '../auth/entities/user.entity';
import { CommunicationsService } from '../communications/communications.service';
import { Service } from '../services/entities/service.entity';
import {
  BookAppointmentDto,
  CreateSlotsDto,
  ListAppointmentsQueryDto,
  ListSlotsQueryDto,
  UpdateAppointmentDto,
  UpdateSlotDto,
} from './dto/appointments.dto';
import { Appointment } from './entities/appointment.entity';
import { AppointmentSlot } from './entities/appointment-slot.entity';

export interface AppointmentList {
  items: Appointment[];
  total: number;
  page: number;
  limit: number;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatAppointment(body: {
  startsAt: Date;
  endsAt: Date;
  ref: string;
}) {
  return `Rendez-vous ${body.ref} le ${body.startsAt.toISOString().slice(0, 16).replace('T', ' à ')} (${body.startsAt.toISOString().slice(11, 16)} – ${body.endsAt.toISOString().slice(11, 16)}).`;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    @InjectRepository(AppointmentSlot)
    private readonly slots: Repository<AppointmentSlot>,
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly communications: CommunicationsService,
    private readonly audit: AuditService,
  ) {}

  // ─── Créneaux (F39) ────────────────────────────────────────────────────────

  async createSlots(
    actorId: string,
    dto: CreateSlotsDto,
  ): Promise<AppointmentSlot[]> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start > end)
      throw new BadRequestException('startDate must be before endDate');
    const startMin = toMinutes(dto.startTime);
    const endMin = toMinutes(dto.endTime);
    if (endMin <= startMin) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (dto.serviceId) {
      const service = await this.services.findOne({
        where: { id: dto.serviceId },
      });
      if (!service) throw new NotFoundException('Service not found');
    }
    if (dto.agentId) {
      const agent = await this.users.findOne({ where: { id: dto.agentId } });
      if (!agent) throw new NotFoundException('Agent not found');
    }
    const daysOfWeek = dto.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6];
    const created: AppointmentSlot[] = [];
    for (
      let day = new Date(start);
      day <= end;
      day.setDate(day.getDate() + 1)
    ) {
      if (!daysOfWeek.includes(day.getUTCDay())) continue;
      for (
        let m = startMin;
        m + dto.slotDurationMinutes <= endMin;
        m += dto.slotDurationMinutes
      ) {
        const startsAt = new Date(
          Date.UTC(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            Math.floor(m / 60),
            m % 60,
          ),
        );
        if (startsAt <= new Date()) continue;
        const endsAt = new Date(
          startsAt.getTime() + dto.slotDurationMinutes * 60_000,
        );
        created.push(
          await this.slots.save(
            this.slots.create({
              serviceId: dto.serviceId ?? null,
              agentId: dto.agentId ?? null,
              startsAt,
              endsAt,
              status: 'available',
              createdById: actorId,
            }),
          ),
        );
      }
    }
    if (created.length > 0) {
      await this.audit.log({
        actorId,
        action: 'create',
        entityType: 'appointment_slot',
        summary: `Création de ${created.length} créneaux (${dto.startDate} → ${dto.endDate})`,
      });
    }
    return created;
  }

  async listSlots(query: ListSlotsQueryDto): Promise<AppointmentSlot[]> {
    const day = new Date(query.date);
    const start = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    );
    const end = new Date(start.getTime() + 24 * 3600_000);
    const where: Record<string, unknown> = {
      startsAt: Between(start, end),
      status: 'available',
    };
    if (query.serviceId) where.serviceId = query.serviceId;
    return this.slots.find({
      where,
      relations: { service: true },
      order: { startsAt: 'ASC' },
    });
  }

  async updateSlot(id: string, dto: UpdateSlotDto): Promise<AppointmentSlot> {
    const slot = await this.slots.findOne({ where: { id } });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.status === 'booked' && dto.status !== 'booked') {
      throw new BadRequestException(
        'A booked slot can only be freed by cancelling the appointment',
      );
    }
    if (dto.status !== undefined)
      slot.status = dto.status as AppointmentSlot['status'];
    return this.slots.save(slot);
  }

  // ─── Rendez-vous (F39/F40) ─────────────────────────────────────────────────

  async book(citizenId: string, dto: BookAppointmentDto): Promise<Appointment> {
    const slot = await this.slots.findOne({
      where: { id: dto.slotId },
      relations: { service: true },
    });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.status !== 'available') {
      throw new ConflictException('Slot is no longer available');
    }
    if (slot.startsAt <= new Date()) {
      throw new BadRequestException('This slot is in the past');
    }
    slot.status = 'booked';
    await this.slots.save(slot);
    const reminderMinutes = dto.reminderMinutes ?? 60;
    const appointment = await this.appointments.save(
      this.appointments.create({
        ref: `APT-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`,
        citizenId,
        slotId: slot.id,
        serviceId: slot.serviceId,
        agentId: slot.agentId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: 'scheduled',
        location: slot.service?.name ?? null,
        notes: dto.notes ?? null,
        reminderMinutes,
      }),
    );
    // Confirmation immédiate
    await this.communications.notify(
      citizenId,
      'appointment',
      `Rendez-vous confirmé ${appointment.ref}`,
      `${formatAppointment(appointment)}${slot.service ? ` Service : ${slot.service.name}.` : ''} Préparez vos documents et présentez-vous à l'heure convenue.`,
      'normal',
      {
        entityType: 'appointment',
        entityId: appointment.id,
        url: `/appointments/${appointment.id}`,
        ref: appointment.ref,
        startsAt: appointment.startsAt.toISOString(),
      },
    );
    // Rappel planifié (F40)
    const reminderAt = new Date(
      appointment.startsAt.getTime() - reminderMinutes * 60_000,
    );
    if (reminderAt > new Date()) {
      await this.communications.notify(
        citizenId,
        'reminder',
        `Rappel : rendez-vous ${appointment.ref}`,
        `${formatAppointment(appointment)} dans ${reminderMinutes} minutes.`,
        'high',
        {
          entityType: 'appointment',
          entityId: appointment.id,
          url: `/appointments/${appointment.id}`,
          ref: appointment.ref,
          startsAt: appointment.startsAt.toISOString(),
        },
        reminderAt,
      );
    }
    await this.audit.log({
      actorId: citizenId,
      action: 'create',
      entityType: 'appointment',
      entityId: appointment.id,
      summary: `Réservation ${appointment.ref}`,
    });
    return this.get(citizenId, appointment.id);
  }

  async myAppointments(userId: string): Promise<Appointment[]> {
    return this.appointments.find({
      where: { citizenId: userId },
      relations: { slot: true, service: true },
      order: { startsAt: 'DESC' },
    });
  }

  async list(query: ListAppointmentsQueryDto): Promise<AppointmentList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.date) {
      const day = new Date(query.date);
      const start = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
      );
      where.startsAt = Between(
        start,
        new Date(start.getTime() + 24 * 3600_000),
      );
    }
    if (query.status) where.status = query.status;
    if (query.serviceId) where.serviceId = query.serviceId;
    if (query.citizenId) where.citizenId = query.citizenId;
    const [items, total] = await this.appointments.findAndCount({
      where,
      relations: { citizen: true, service: true, slot: true, agent: true },
      order: { startsAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async get(actorId: string, id: string): Promise<Appointment> {
    const appointment = await this.appointments.findOne({
      where: { id },
      relations: { citizen: true, service: true, slot: true, agent: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.citizenId !== actorId) {
      throw new ForbiddenException('You can only read your own appointments');
    }
    return appointment;
  }

  async cancel(
    userId: string,
    id: string,
    byAgent = false,
  ): Promise<Appointment> {
    const appointment = await this.appointments.findOne({
      where: { id },
      relations: { slot: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (!byAgent && appointment.citizenId !== userId) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }
    if (appointment.status === 'cancelled') {
      throw new BadRequestException('Appointment is already cancelled');
    }
    if (appointment.status === 'completed') {
      throw new BadRequestException(
        'Completed appointments cannot be cancelled',
      );
    }
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancelledById = userId;
    await this.appointments.save(appointment);
    if (appointment.slot) {
      appointment.slot.status = 'available';
      await this.slots.save(appointment.slot);
    }
    await this.communications.notify(
      appointment.citizenId,
      'appointment',
      `Rendez-vous annulé ${appointment.ref}`,
      `Votre rendez-vous du ${appointment.startsAt.toISOString().slice(0, 16).replace('T', ' à ')} a été annulé.`,
      'normal',
      {
        entityType: 'appointment',
        entityId: appointment.id,
        url: `/appointments/${appointment.id}`,
      },
    );
    await this.audit.log({
      actorId: userId,
      action: 'cancel',
      entityType: 'appointment',
      entityId: appointment.id,
      summary: `Annulation ${appointment.ref}`,
    });
    return appointment;
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.appointments.findOne({ where: { id } });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (dto.status !== undefined) {
      appointment.status = dto.status as Appointment['status'];
    }
    if (dto.agentId !== undefined) {
      if (dto.agentId) {
        const agent = await this.users.findOne({ where: { id: dto.agentId } });
        if (!agent) throw new NotFoundException('Agent not found');
      }
      appointment.agentId = dto.agentId ?? null;
    }
    if (dto.location !== undefined) appointment.location = dto.location ?? null;
    if (dto.notes !== undefined) appointment.notes = dto.notes ?? null;
    const saved = await this.appointments.save(appointment);
    await this.audit.log({
      actorId,
      action: 'update',
      entityType: 'appointment',
      entityId: saved.id,
      summary: `Mise à jour ${saved.ref} (${saved.status})`,
    });
    return saved;
  }
}
