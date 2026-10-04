import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { User } from '../auth/entities/user.entity';
import { CommunicationsModule } from '../communications/communications.module';
import { Service } from '../services/entities/service.entity';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { Appointment } from './entities/appointment.entity';
import { AppointmentSlot } from './entities/appointment-slot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, AppointmentSlot, Service, User]),
    CommunicationsModule,
    AuditModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
