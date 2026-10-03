import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsModule } from '../communications/communications.module';
import { I18nModule } from '../i18n/i18n.module';
import { Request } from '../requests/entities/request.entity';
import { Service } from './entities/service.entity';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service, Request]),
    I18nModule,
    CommunicationsModule,
    AuditModule,
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
