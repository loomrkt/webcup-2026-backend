import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { CommunicationsModule } from '../communications/communications.module';
import {
  ConsultationsController,
  IdeasController,
  ProjectsController,
} from './civic.controller';
import { CivicService } from './civic.service';
import { CitizenIdea } from './entities/citizen-idea.entity';
import { CityProject } from './entities/city-project.entity';
import { Consultation } from './entities/consultation.entity';
import { ConsultationResponse } from './entities/consultation-response.entity';
import { ProjectFeedback } from './entities/project-feedback.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CityProject,
      Consultation,
      ConsultationResponse,
      ProjectFeedback,
      CitizenIdea,
      User,
    ]),
    CommunicationsModule,
  ],
  controllers: [ProjectsController, ConsultationsController, IdeasController],
  providers: [CivicService],
  exports: [CivicService],
})
export class CivicModule {}
