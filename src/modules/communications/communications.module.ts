import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { User } from '../auth/entities/user.entity';
import { AiAlertService } from './ai-alert.service';
import {
  AlertsController,
  AnnouncementsController,
  NotificationsController,
} from './communications.controller';
import { CommunicationsService } from './communications.service';
import { Announcement } from './entities/announcement.entity';
import { Alert } from './entities/alert.entity';
import { Notification } from './entities/notification.entity';
import { ReminderDispatcher } from './reminder-dispatcher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, Alert, Notification, User]),
    AuditModule,
  ],
  controllers: [
    AnnouncementsController,
    AlertsController,
    NotificationsController,
  ],
  providers: [CommunicationsService, AiAlertService, ReminderDispatcher],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
