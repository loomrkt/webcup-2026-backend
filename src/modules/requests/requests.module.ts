import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { User } from '../auth/entities/user.entity';
import { Service } from '../services/entities/service.entity';
import { RequestHistory } from './entities/request-history.entity';
import { Request } from './entities/request.entity';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Request, RequestHistory, User, Service]),
    AuditModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
