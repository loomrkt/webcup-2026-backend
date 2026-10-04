import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Service } from '../services/entities/service.entity';
import { AuditService } from '../audit/audit.service';
import {
  CreateMobilityLineDto,
  CreateScheduleDto,
  ListMobilityLinesQueryDto,
  UpdateMobilityLineDto,
  UpdateScheduleDto,
} from './dto/mobility.dto';
import { MobilityLine } from './entities/mobility-line.entity';
import {
  MobilitySchedule,
  type ScheduleDayType,
} from './entities/mobility-schedule.entity';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function dayTypeOf(date: Date): ScheduleDayType {
  const day = date.getUTCDay();
  if (day === 6) return 'saturday';
  if (day === 0) return 'sunday';
  return 'weekday';
}

const DEMO_LINES: Array<{
  name: string;
  code: string;
  origin: string;
  destination: string;
  color: string;
  info: string;
  price: string;
  frequency: string;
  accessible: boolean;
}> = [
  {
    name: 'Tramway Nova',
    code: 'T1',
    origin: 'Gare Centrale',
    destination: 'Quartier Sud',
    color: '#2563eb',
    info: 'Tramway reliant la gare au quartier sud, dessert le centre-ville.',
    price: '2,00 € / trajet',
    frequency: 'Toutes les 10 min en journée',
    accessible: true,
  },
  {
    name: 'Bus Express',
    code: 'B2',
    origin: 'Place de la Mairie',
    destination: 'Hôpital Nord',
    color: '#dc2626',
    info: 'Ligne express vers l’hôpital, arrêts limités.',
    price: '1,50 € / trajet',
    frequency: 'Toutes les 15 min',
    accessible: true,
  },
  {
    name: 'Navette Rive Est',
    code: 'N3',
    origin: 'Rive Est',
    destination: 'Marché central',
    color: '#059669',
    info: 'Navette de quartier pour la rive est.',
    price: '1,00 € / trajet',
    frequency: 'Toutes les 30 min',
    accessible: false,
  },
];

const DEMO_SCHEDULES: Array<{
  code: string;
  dayType: ScheduleDayType;
  destination: string;
  times: string[];
}> = [
  {
    code: 'T1',
    dayType: 'weekday',
    destination: 'Quartier Sud',
    times: [
      '06:30',
      '07:00',
      '07:30',
      '08:00',
      '08:30',
      '09:00',
      '12:00',
      '17:00',
      '17:30',
      '18:00',
      '19:00',
      '20:00',
      '22:00',
    ],
  },
  {
    code: 'T1',
    dayType: 'saturday',
    destination: 'Quartier Sud',
    times: [
      '07:00',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '14:00',
      '16:00',
      '18:00',
      '20:00',
    ],
  },
  {
    code: 'T1',
    dayType: 'sunday',
    destination: 'Quartier Sud',
    times: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
  },
  {
    code: 'B2',
    dayType: 'weekday',
    destination: 'Hôpital Nord',
    times: [
      '06:45',
      '07:15',
      '07:45',
      '08:15',
      '08:45',
      '09:15',
      '12:15',
      '17:15',
      '17:45',
      '18:15',
      '19:15',
    ],
  },
  {
    code: 'B2',
    dayType: 'saturday',
    destination: 'Hôpital Nord',
    times: [
      '07:15',
      '08:15',
      '09:15',
      '10:15',
      '11:15',
      '12:15',
      '14:15',
      '16:15',
      '18:15',
    ],
  },
  {
    code: 'B2',
    dayType: 'sunday',
    destination: 'Hôpital Nord',
    times: ['08:15', '10:15', '12:15', '14:15', '16:15', '18:15'],
  },
  {
    code: 'N3',
    dayType: 'weekday',
    destination: 'Marché central',
    times: [
      '06:30',
      '07:00',
      '07:30',
      '08:00',
      '08:30',
      '09:00',
      '12:00',
      '14:00',
      '16:00',
      '17:30',
      '18:30',
      '19:30',
    ],
  },
  {
    code: 'N3',
    dayType: 'saturday',
    destination: 'Marché central',
    times: [
      '07:30',
      '08:30',
      '09:30',
      '10:30',
      '11:30',
      '12:30',
      '14:30',
      '16:30',
      '18:30',
    ],
  },
  {
    code: 'N3',
    dayType: 'sunday',
    destination: 'Marché central',
    times: ['08:30', '10:30', '12:30', '14:30', '16:30'],
  },
];

@Injectable()
export class MobilityService implements OnModuleInit {
  private readonly logger = new Logger(MobilityService.name);

  constructor(
    @InjectRepository(MobilityLine)
    private readonly lines: Repository<MobilityLine>,
    @InjectRepository(MobilitySchedule)
    private readonly schedules: Repository<MobilitySchedule>,
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    if ((this.config.get<string>('MOBILITY_SEED_DEMO') ?? 'true') !== 'true') {
      return;
    }
    try {
      await this.seedDemoData();
    } catch (error) {
      this.logger.warn(
        `Mobility demo seed skipped (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }

  private async seedDemoData(): Promise<void> {
    const lineCount = await this.lines.count();
    if (lineCount === 0) {
      for (const line of DEMO_LINES) {
        await this.lines.save(this.lines.create(line));
      }
      const saved = await this.lines.find();
      const byCode = new Map(saved.map((l) => [l.code, l.id]));
      for (const sched of DEMO_SCHEDULES) {
        const lineId = byCode.get(sched.code);
        if (!lineId) continue;
        await this.schedules.save(
          this.schedules.create(
            sched.times.map((time) => ({
              lineId,
              dayType: sched.dayType,
              destination: sched.destination,
              departureTime: time,
            })),
          ),
        );
      }
      this.logger.log('Mobility demo data seeded (3 lines)');
    }
    const service = await this.services.findOne({
      where: { slug: 'transports-municipaux' },
    });
    if (!service) {
      await this.services.save(
        this.services.create({
          name: 'Transports municipaux',
          slug: 'transports-municipaux',
          description:
            'Horaires, lignes et informations pratiques des transports municipaux de Nova Terra.',
          category: 'mobilite',
          icon: 'bus',
          order: 10,
          active: true,
        }),
      );
    }
  }

  private resolveDay(day?: string): ScheduleDayType {
    if (day === 'today' || !day) return dayTypeOf(new Date());
    return day as ScheduleDayType;
  }

  async list(query: ListMobilityLinesQueryDto) {
    const term = query.q?.trim();
    const dayType = this.resolveDay(query.day);
    let lines = await this.lines.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    if (term) {
      const normalized = normalizeText(term);
      lines = lines.filter((line) => {
        const haystack = normalizeText(
          [line.name, line.code, line.origin, line.destination].join(' '),
        );
        return haystack.includes(normalized);
      });
    }
    const ids = lines.map((l) => l.id);
    const schedules = ids.length
      ? await this.schedules.find({
          where: { lineId: In(ids), dayType },
          order: { departureTime: 'ASC' },
        })
      : [];
    return {
      items: lines.map((line) => ({
        ...line,
        schedules: schedules
          .filter((s) => s.lineId === line.id)
          .map((s) => ({
            departureTime: s.departureTime,
            destination: s.destination,
          })),
      })),
      dayType,
    };
  }

  async get(id: string, day?: string) {
    const line = await this.lines.findOne({ where: { id, active: true } });
    if (!line) throw new NotFoundException('Mobility line not found');
    const dayType = this.resolveDay(day);
    const schedules = await this.schedules.find({
      where: { lineId: line.id, dayType },
      order: { departureTime: 'ASC' },
    });
    return {
      ...line,
      schedules,
      dayType,
    };
  }

  async listAll() {
    const lines = await this.lines.find({ order: { name: 'ASC' } });
    return Promise.all(
      lines.map(async (line) => ({
        ...line,
        schedules: await this.schedules.find({
          where: { lineId: line.id },
          order: { dayType: 'ASC', departureTime: 'ASC' },
        }),
      })),
    );
  }

  async create(
    actorId: string,
    dto: CreateMobilityLineDto,
  ): Promise<MobilityLine> {
    const existing = await this.lines.findOne({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Line code "${dto.code}" already exists`);
    }
    const line = await this.lines.save(
      this.lines.create({
        name: dto.name.trim(),
        code: dto.code.toUpperCase(),
        origin: dto.origin ?? null,
        destination: dto.destination ?? null,
        color: dto.color ?? null,
        info: dto.info ?? null,
        price: dto.price ?? null,
        frequency: dto.frequency ?? null,
        accessible: dto.accessible ?? true,
        active: dto.active ?? true,
      }),
    );
    await this.audit.log({
      actorId,
      action: 'create',
      entityType: 'mobility_line',
      entityId: line.id,
      summary: `Création de la ligne ${line.code} « ${line.name} »`,
    });
    return line;
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateMobilityLineDto,
  ): Promise<MobilityLine> {
    const line = await this.lines.findOne({ where: { id } });
    if (!line) throw new NotFoundException('Mobility line not found');
    if (dto.name !== undefined) line.name = dto.name.trim();
    if (dto.code !== undefined) {
      const code = dto.code.toUpperCase();
      const clash = await this.lines.findOne({ where: { code } });
      if (clash && clash.id !== id) {
        throw new ConflictException(`Line code "${code}" already exists`);
      }
      line.code = code;
    }
    if (dto.origin !== undefined) line.origin = dto.origin ?? null;
    if (dto.destination !== undefined) {
      line.destination = dto.destination ?? null;
    }
    if (dto.color !== undefined) line.color = dto.color ?? null;
    if (dto.info !== undefined) line.info = dto.info ?? null;
    if (dto.price !== undefined) line.price = dto.price ?? null;
    if (dto.frequency !== undefined) line.frequency = dto.frequency ?? null;
    if (dto.accessible !== undefined) line.accessible = dto.accessible;
    if (dto.active !== undefined) line.active = dto.active;
    const saved = await this.lines.save(line);
    await this.audit.log({
      actorId,
      action: 'update',
      entityType: 'mobility_line',
      entityId: saved.id,
      summary: `Modification de la ligne ${saved.code} « ${saved.name} »`,
    });
    return saved;
  }

  async remove(actorId: string, id: string): Promise<void> {
    const line = await this.lines.findOne({ where: { id } });
    if (!line) throw new NotFoundException('Mobility line not found');
    await this.lines.delete({ id });
    await this.audit.log({
      actorId,
      action: 'delete',
      entityType: 'mobility_line',
      entityId: id,
      summary: `Suppression de la ligne ${line.code} « ${line.name} »`,
    });
  }

  async addSchedule(
    lineId: string,
    dto: CreateScheduleDto,
  ): Promise<MobilitySchedule> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Mobility line not found');
    return this.schedules.save(
      this.schedules.create({
        lineId,
        dayType: dto.dayType,
        destination: dto.destination ?? line.destination,
        departureTime: dto.departureTime,
      }),
    );
  }

  async updateSchedule(
    scheduleId: string,
    dto: UpdateScheduleDto,
  ): Promise<MobilitySchedule> {
    const schedule = await this.schedules.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (dto.dayType !== undefined) schedule.dayType = dto.dayType;
    if (dto.destination !== undefined) {
      schedule.destination = dto.destination ?? null;
    }
    if (dto.departureTime !== undefined) {
      schedule.departureTime = dto.departureTime;
    }
    return this.schedules.save(schedule);
  }

  async removeSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.schedules.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.schedules.delete({ id: scheduleId });
  }
}
