import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../services/entities/service.entity';
import { MobilityLine } from './entities/mobility-line.entity';
import { MobilitySchedule } from './entities/mobility-schedule.entity';
import { MobilityController } from './mobility.controller';
import { MobilityService } from './mobility.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MobilityLine, MobilitySchedule, Service]),
  ],
  controllers: [MobilityController],
  providers: [MobilityService],
  exports: [MobilityService],
})
export class MobilityModule {}
