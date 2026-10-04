import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AiAlertService, type AiAlertDraft } from './ai-alert.service';
import {
  AiGenerateAlertDto,
  CreateAlertDto,
  CreateAnnouncementDto,
  NotificationQueryDto,
  UpdateAlertDto,
  UpdateAnnouncementDto,
  UpdateNotificationPrefsDto,
} from './dto/communications.dto';
import { Announcement } from './entities/announcement.entity';
import { Alert } from './entities/alert.entity';
import { Notification } from './entities/notification.entity';

const DEFAULT_PREFS: Record<string, boolean> = {
  announcement: true,
  alert: true,
  system: true,
};

const VULNERABLE_AGE = 65;

export interface NotificationList {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
}

@Injectable()
export class CommunicationsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcements: Repository<Announcement>,
    @InjectRepository(Alert)
    private readonly alerts: Repository<Alert>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly ai: AiAlertService,
    private readonly audit: AuditService,
  ) {}

  // ─── Annonces (D18) ────────────────────────────────────────────────────────

  async createAnnouncement(
    actorId: string,
    dto: CreateAnnouncementDto,
  ): Promise<Announcement> {
    const publish = dto.publish === true;
    const announcement = await this.announcements.save(
      this.announcements.create({
        title: dto.title.trim(),
        content: dto.content,
        priority: dto.priority ?? 'normal',
        status: publish ? 'published' : 'draft',
        zone: dto.zone ?? null,
        ctaLabel: dto.ctaLabel ?? null,
        ctaUrl: dto.ctaUrl ?? null,
        startsAt: dto.startsAt
          ? new Date(dto.startsAt)
          : publish
            ? new Date()
            : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        publishedAt: publish ? new Date() : null,
        createdById: actorId,
      }),
    );
    if (publish) await this.broadcastAnnouncement(announcement);
    await this.audit.log({
      actorId,
      action: publish ? 'publish' : 'create',
      entityType: 'announcement',
      entityId: announcement.id,
      summary: `${publish ? 'Publication' : 'Création'} de l'annonce « ${announcement.title} »`,
    });
    return announcement;
  }

  async listPublicAnnouncements(light = false): Promise<Announcement[]> {
    const announcements = await this.announcements.find({
      where: { status: 'published' },
      select: light
        ? {
            id: true,
            title: true,
            priority: true,
            zone: true,
            startsAt: true,
            endsAt: true,
            ctaLabel: true,
            ctaUrl: true,
          }
        : undefined,
      order: { publishedAt: 'DESC' },
    });
    const now = new Date();
    return announcements.filter(
      (a) =>
        (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt >= now),
    );
  }

  async getPublicAnnouncement(id: string): Promise<Announcement> {
    const announcement = await this.announcements.findOne({
      where: { id, status: 'published' },
    });
    if (
      !announcement ||
      (announcement.endsAt && announcement.endsAt < new Date()) ||
      (announcement.startsAt && announcement.startsAt > new Date())
    ) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async listAllAnnouncements(): Promise<Announcement[]> {
    return this.announcements.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getAnnouncement(id: string): Promise<Announcement> {
    const announcement = await this.announcements.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async updateAnnouncement(
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<Announcement> {
    const announcement = await this.announcements.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    if (dto.title !== undefined) announcement.title = dto.title.trim();
    if (dto.content !== undefined) announcement.content = dto.content;
    if (dto.priority !== undefined) announcement.priority = dto.priority;
    if (dto.zone !== undefined) announcement.zone = dto.zone ?? null;
    if (dto.ctaLabel !== undefined) {
      announcement.ctaLabel = dto.ctaLabel ?? null;
    }
    if (dto.ctaUrl !== undefined) announcement.ctaUrl = dto.ctaUrl ?? null;
    if (dto.startsAt !== undefined) {
      announcement.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    }
    if (dto.endsAt !== undefined) {
      announcement.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }
    const wasPublished = announcement.status === 'published';
    if (dto.status !== undefined) {
      announcement.status = dto.status;
      if (dto.status === 'published' && !announcement.publishedAt) {
        announcement.publishedAt = new Date();
      }
    }
    const saved = await this.announcements.save(announcement);
    if (saved.status === 'published' && !wasPublished) {
      await this.broadcastAnnouncement(saved);
    }
    await this.audit.log({
      action: 'update',
      entityType: 'announcement',
      entityId: saved.id,
      summary: `Modification de l'annonce « ${saved.title} » (statut : ${saved.status})`,
    });
    return saved;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    const announcement = await this.announcements.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.announcements.delete({ id });
    await this.audit.log({
      action: 'delete',
      entityType: 'announcement',
      entityId: id,
      summary: `Suppression de l'annonce « ${announcement.title} »`,
    });
  }

  // ─── Alertes (F29) ─────────────────────────────────────────────────────────

  async generateAlertDraft(input: AiGenerateAlertDto): Promise<AiAlertDraft> {
    return this.ai.generate(input);
  }

  async createAlert(actorId: string, dto: CreateAlertDto): Promise<Alert> {
    const publish = dto.publish === true;
    const alert = await this.alerts.save(
      this.alerts.create({
        title: dto.title.trim(),
        message: dto.message,
        criticality: dto.criticality ?? 'warning',
        status: publish ? 'active' : 'draft',
        zone: dto.zone ?? null,
        recommendations: dto.recommendations ?? null,
        vulnerableRecommendations: dto.vulnerableRecommendations ?? null,
        startsAt: dto.startsAt
          ? new Date(dto.startsAt)
          : publish
            ? new Date()
            : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        publishedAt: publish ? new Date() : null,
        createdById: actorId,
      }),
    );
    if (publish) await this.broadcastAlert(alert);
    await this.audit.log({
      actorId,
      action: publish ? 'publish' : 'create',
      entityType: 'alert',
      entityId: alert.id,
      summary: `${publish ? 'Activation' : 'Création'} de l'alerte « ${alert.title} »`,
    });
    return alert;
  }

  async listActiveAlerts(zone?: string, light = false): Promise<Alert[]> {
    const where: Record<string, unknown> = { status: 'active' };
    if (zone) where.zone = zone;
    const alerts = await this.alerts.find({
      where,
      select: light
        ? {
            id: true,
            title: true,
            message: true,
            criticality: true,
            zone: true,
            endsAt: true,
            publishedAt: true,
          }
        : undefined,
      order: { publishedAt: 'DESC' },
    });
    const now = new Date();
    return alerts.filter(
      (a) =>
        (!a.endsAt || a.endsAt >= now) && (!a.startsAt || a.startsAt <= now),
    );
  }

  async listAllAlerts(): Promise<Alert[]> {
    return this.alerts.find({ order: { createdAt: 'DESC' } });
  }

  async getAlert(id: string): Promise<Alert> {
    const alert = await this.alerts.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async updateAlert(id: string, dto: UpdateAlertDto): Promise<Alert> {
    const alert = await this.alerts.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (dto.title !== undefined) alert.title = dto.title.trim();
    if (dto.message !== undefined) alert.message = dto.message;
    if (dto.criticality !== undefined) alert.criticality = dto.criticality;
    if (dto.zone !== undefined) alert.zone = dto.zone ?? null;
    if (dto.recommendations !== undefined) {
      alert.recommendations = dto.recommendations ?? null;
    }
    if (dto.vulnerableRecommendations !== undefined) {
      alert.vulnerableRecommendations = dto.vulnerableRecommendations ?? null;
    }
    if (dto.startsAt !== undefined) {
      alert.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    }
    if (dto.endsAt !== undefined) {
      alert.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }
    const wasActive = alert.status === 'active';
    if (dto.status !== undefined) {
      alert.status = dto.status;
      if (dto.status === 'active' && !alert.publishedAt) {
        alert.publishedAt = new Date();
      }
      if (dto.status === 'resolved') alert.endsAt = new Date();
    }
    const saved = await this.alerts.save(alert);
    if (saved.status === 'active' && !wasActive) {
      await this.broadcastAlert(saved);
    }
    await this.audit.log({
      action: 'update',
      entityType: 'alert',
      entityId: saved.id,
      summary: `Modification de l'alerte « ${saved.title} » (statut : ${saved.status})`,
    });
    return saved;
  }

  /** Active l'alerte (même depuis un brouillon) et diffuse les notifications. */
  async diffuseAlert(id: string): Promise<Alert> {
    return this.updateAlert(id, { status: 'active' });
  }

  async deleteAlert(id: string): Promise<void> {
    const alert = await this.alerts.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    await this.alerts.delete({ id });
    await this.audit.log({
      action: 'delete',
      entityType: 'alert',
      entityId: id,
      summary: `Suppression de l'alerte « ${alert.title} »`,
    });
  }

  // ─── Diffusion / Notifications (F30) ───────────────────────────────────────

  /** Crée une notification immédiate ou planifiée (rappel F40). */
  async notify(
    userId: string,
    type: string,
    title: string,
    body: string,
    priority = 'normal',
    payload?: Record<string, unknown> | null,
    scheduledAt?: Date | null,
  ): Promise<Notification> {
    return this.notifications.save(
      this.notifications.create({
        userId,
        type: type as Notification['type'],
        title,
        body,
        priority,
        payload: payload ?? null,
        scheduledAt: scheduledAt ?? null,
      }),
    );
  }

  private isVulnerable(user: Pick<User, 'birthDate'>): boolean {
    if (!user.birthDate) return false;
    const birth = new Date(user.birthDate);
    if (Number.isNaN(birth.getTime())) return false;
    const age = (Date.now() - birth.getTime()) / (365.25 * 24 * 3600_000);
    return age >= VULNERABLE_AGE;
  }

  private async targetedUsers(
    zone: string | null,
  ): Promise<Array<Pick<User, 'id' | 'birthDate' | 'notificationPrefs'>>> {
    const qb = this.users
      .createQueryBuilder('user')
      .select(['user.id', 'user.birthDate', 'user.notificationPrefs']);
    if (zone) {
      qb.where('(user.city ILIKE :zone OR user.address ILIKE :zone)', {
        zone: `%${zone}%`,
      });
    }
    return qb.getMany();
  }

  private async saveNotifications(rows: Partial<Notification>[]) {
    if (rows.length === 0) return;
    const chunk = 200;
    for (let i = 0; i < rows.length; i += chunk) {
      await this.notifications.save(
        this.notifications.create(rows.slice(i, i + chunk)),
      );
    }
  }

  async broadcastAnnouncement(announcement: Announcement): Promise<number> {
    const users = await this.targetedUsers(announcement.zone);
    const rows = users
      .filter((u) => (u.notificationPrefs?.announcement ?? true) !== false)
      .map((u) => ({
        userId: u.id,
        type: 'announcement' as const,
        title: announcement.title,
        body: announcement.content,
        priority: announcement.priority,
        payload: {
          entityType: 'announcement',
          entityId: announcement.id,
          url: `/announcements/${announcement.id}`,
        },
      }));
    await this.saveNotifications(rows);
    return rows.length;
  }

  async broadcastAlert(alert: Alert): Promise<number> {
    const users = await this.targetedUsers(alert.zone);
    const rows = users
      .filter((u) => (u.notificationPrefs?.alert ?? true) !== false)
      .map((u) => {
        const vulnerable = this.isVulnerable(u);
        const body = vulnerable
          ? [
              alert.message,
              alert.vulnerableRecommendations?.length
                ? `Consignes adaptées : ${alert.vulnerableRecommendations.join(' ')}`
                : null,
            ]
              .filter(Boolean)
              .join('\n')
          : alert.message;
        return {
          userId: u.id,
          type: 'alert' as const,
          title: alert.title,
          body,
          priority: vulnerable ? 'high' : alert.criticality,
          payload: {
            entityType: 'alert',
            entityId: alert.id,
            url: `/alerts/${alert.id}`,
            vulnerable,
            recommendations: alert.recommendations,
          },
        };
      });
    await this.saveNotifications(rows);
    return rows.length;
  }

  async myNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const builder = this.notifications
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('(n.scheduledAt IS NULL OR n.scheduledAt <= :now)', { now });
    if (query.type) builder.andWhere('n.type = :type', { type: query.type });
    if (query.read === 'true') {
      builder.andWhere('n.readAt IS NOT NULL');
    } else if (query.read === 'false') {
      builder.andWhere('n.readAt IS NULL');
    }
    builder.orderBy('n.createdAt', 'DESC');
    const [items, total] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const unreadCount = await this.unreadCount(userId);
    return { items, total, page, limit, unreadCount };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifications
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.readAt IS NULL')
      .andWhere('(n.scheduledAt IS NULL OR n.scheduledAt <= :now)', {
        now: new Date(),
      })
      .getCount();
  }

  async markRead(
    userId: string,
    id: string,
    read: boolean,
  ): Promise<Notification> {
    const notification = await this.notifications.findOne({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only update your own notifications',
      );
    }
    notification.readAt = read ? new Date() : null;
    return this.notifications.save(notification);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notifications.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  async getPrefs(userId: string): Promise<Record<string, boolean>> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.mergePrefs(user.notificationPrefs);
  }

  private mergePrefs(
    stored: Record<string, unknown> | null,
  ): Record<string, boolean> {
    const merged: Record<string, boolean> = { ...DEFAULT_PREFS };
    if (stored) {
      for (const [key, value] of Object.entries(stored)) {
        if (typeof value === 'boolean') merged[key] = value;
      }
    }
    return merged;
  }

  async updatePrefs(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<Record<string, boolean>> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const prefs = this.mergePrefs(user.notificationPrefs);
    if (dto.announcement !== undefined) prefs.announcement = dto.announcement;
    if (dto.alert !== undefined) prefs.alert = dto.alert;
    if (dto.system !== undefined) prefs.system = dto.system;
    user.notificationPrefs = prefs;
    await this.users.save(user);
    return prefs;
  }
}
