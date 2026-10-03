import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { ContactMessage } from './entities/contact-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage]), AuditModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
