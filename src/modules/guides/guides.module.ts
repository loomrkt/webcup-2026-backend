import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { User } from '../auth/entities/user.entity';
import { GuideStep } from './entities/guide-step.entity';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({
  imports: [TypeOrmModule.forFeature([GuideStep, User]), AuditModule],
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
