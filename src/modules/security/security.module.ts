import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { CommunicationsModule } from '../communications/communications.module';
import { SecurityEvent } from './entities/security-event.entity';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityEvent, User]),
    CommunicationsModule,
  ],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
