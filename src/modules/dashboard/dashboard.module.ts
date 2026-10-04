import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { ContactMessage } from '../contact/entities/contact-message.entity';
import { Publication } from '../news/entities/publication.entity';
import { Request } from '../requests/entities/request.entity';
import { RequestHistory } from '../requests/entities/request-history.entity';
import { Service } from '../services/entities/service.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Service,
      Publication,
      ContactMessage,
      Request,
      RequestHistory,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
