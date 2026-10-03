import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

/**
 * Distribue les notifications planifiées (rappels de rendez-vous F40) :
 * toute notification dont `scheduledAt` est atteint est marquée `deliveredAt`
 * et devient visible dans le centre de notifications.
 */
@Injectable()
export class ReminderDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderDispatcher.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (
      (
        this.config.get<string>('NOTIFICATIONS_REMINDERS') ?? 'true'
      ).toLowerCase() !== 'true'
    ) {
      return;
    }
    const intervalSec = Number(
      this.config.get<string>('NOTIFICATIONS_REMINDER_INTERVAL') ?? '60',
    );
    this.timer = setInterval(() => void this.dispatchDue(), intervalSec * 1000);
    void this.dispatchDue();
    this.logger.log(`Reminder dispatcher started (every ${intervalSec}s)`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async dispatchDue(): Promise<number> {
    try {
      const now = new Date();
      const due = await this.notifications
        .createQueryBuilder('n')
        .where('n.scheduledAt IS NOT NULL')
        .andWhere('n.scheduledAt <= :now', { now })
        .andWhere('n.deliveredAt IS NULL')
        .getMany();
      if (due.length === 0) return 0;
      await this.notifications.update(
        due.map((n) => n.id),
        { deliveredAt: now },
      );
      this.logger.log(`${due.length} scheduled notification(s) delivered`);
      return due.length;
    } catch (error) {
      this.logger.warn(
        `Reminder dispatch failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      return 0;
    }
  }
}
