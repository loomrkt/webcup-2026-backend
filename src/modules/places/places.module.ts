import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Service } from '../services/entities/service.entity';
import { Place } from './entities/place.entity';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  imports: [TypeOrmModule.forFeature([Place, Service]), AuditModule],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
