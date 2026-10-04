import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { CommunicationsModule } from '../communications/communications.module';
import { Request } from '../requests/entities/request.entity';
import { DataConcern } from './entities/data-concern.entity';
import { RequestSupport } from './entities/request-support.entity';
import {
  ConcernsController,
  SupportsController,
} from './participation.controller';
import { ParticipationService } from './participation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataConcern, RequestSupport, Request, User]),
    CommunicationsModule,
  ],
  controllers: [ConcernsController, SupportsController],
  providers: [ParticipationService],
  exports: [ParticipationService],
})
export class ParticipationModule {}
