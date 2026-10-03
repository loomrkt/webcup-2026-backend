import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, Alert, Notification, User]),
  ],
  controllers: [
    AnnouncementsController,
    AlertsController,
    NotificationsController,
  ],
  providers: [CommunicationsService, AiAlertService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
