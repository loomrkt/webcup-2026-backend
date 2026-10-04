import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { User } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Notification } from '../communications/entities/notification.entity';
import { DataConcern } from '../participation/entities/data-concern.entity';
import { RequestSupport } from '../participation/entities/request-support.entity';
import { Request } from '../requests/entities/request.entity';
import { RequestHistory } from '../requests/entities/request-history.entity';
import { SecurityEvent } from '../security/entities/security-event.entity';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Request)
    private readonly requests: Repository<Request>,
    @InjectRepository(RequestHistory)
    private readonly history: Repository<RequestHistory>,
    @InjectRepository(RequestSupport)
    private readonly supports: Repository<RequestSupport>,
    @InjectRepository(DataConcern)
    private readonly concerns: Repository<DataConcern>,
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(SecurityEvent)
    private readonly securityEvents: Repository<SecurityEvent>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  /**
   * F55 — export structuré et lisible des données personnelles détenues par
   * la ville (RGPD : droit d'accès). Jamais de données brutes : chaque section
   * est présentée de façon exploitable.
   */
  async exportData(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const myRequests = await this.requests.find({
      where: { citizenId: userId },
      relations: { history: true, service: true },
      order: { createdAt: 'DESC' },
    });
    const mySupports = await this.supports.find({
      where: { userId },
      relations: { request: true },
      order: { createdAt: 'DESC' },
    });
    const myConcerns = await this.concerns.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const myAppointments = await this.appointments.find({
      where: { citizenId: userId },
      order: { startsAt: 'DESC' },
    });
    const myNotifications = await this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const mySecurityEvents = await this.securityEvents.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const mySessions = await this.refreshTokens.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const historyOfMyRequests = await this.history.find({
      where: { request: { citizenId: userId } },
      relations: { request: true },
      order: { createdAt: 'DESC' },
    });

    return {
      exportedAt: new Date().toISOString(),
      generatedBy: 'Nova Terra — plateforme de participation citoyenne',
      profile: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        city: user.city,
        birthDate: user.birthDate,
        language: user.language ?? 'fr',
        accountCreatedAt: user.createdAt,
        accountStatus: user.status,
        emailVerified: !!user.emailVerifiedAt,
        twoFactorEnabled: user.totpActive || user.mfaEmailActive || false,
      },
      requests: myRequests.map((r) => ({
        ref: r.ref,
        title: r.title,
        description: r.description,
        category: r.category,
        location: r.location,
        status: r.status,
        priority: r.priority,
        service: r.service?.name ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      requestHistory: historyOfMyRequests.map((h) => ({
        requestRef: h.request?.ref ?? h.requestId,
        status: h.status,
        comment: h.comment,
        createdAt: h.createdAt,
      })),
      supports: mySupports.map((s) => ({
        requestRef: s.request?.ref ?? null,
        supportedAt: s.createdAt,
      })),
      dataConcerns: myConcerns.map((c) => ({
        category: c.category,
        message: c.message,
        status: c.status,
        response: c.response,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      appointments: myAppointments.map((a) => ({
        ref: a.ref,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status,
        location: a.location,
        notes: a.notes,
      })),
      notifications: myNotifications.map((n) => ({
        type: n.type,
        title: n.title,
        body: n.body,
        priority: n.priority,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      securityEvents: mySecurityEvents.map((e) => ({
        type: e.type,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
      sessions: mySessions.map((s) => ({
        ip: s.ip,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
      })),
    };
  }
}
