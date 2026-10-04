import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { User } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Notification } from '../communications/entities/notification.entity';
import { DataConcern } from '../participation/entities/data-concern.entity';
import { RequestSupport } from '../participation/entities/request-support.entity';
import { Request } from '../requests/entities/request.entity';
import { RequestHistory } from '../requests/entities/request-history.entity';
import { SecurityEvent } from '../security/entities/security-event.entity';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Request,
      RequestHistory,
      RequestSupport,
      DataConcern,
      Appointment,
      Notification,
      SecurityEvent,
      RefreshToken,
    ]),
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
