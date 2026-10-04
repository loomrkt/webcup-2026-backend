import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateContactMessageDto,
  UpdateContactMessageDto,
} from './dto/contact.dto';
import { ContactMessage } from './entities/contact-message.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly messages: Repository<ContactMessage>,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateContactMessageDto,
  ): Promise<{ reference: string; message: ContactMessage }> {
    const saved = await this.messages.save(
      this.messages.create({
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        subject: dto.subject ?? null,
        category: dto.category ?? null,
        message: dto.message,
        status: 'new',
      }),
    );
    return {
      reference: `CT-${saved.id.slice(0, 8).toUpperCase()}`,
      message: saved,
    };
  }

  async listAll(): Promise<ContactMessage[]> {
    return this.messages.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateContactMessageDto,
  ): Promise<ContactMessage> {
    const message = await this.messages.findOne({ where: { id } });
    if (!message) throw new NotFoundException('Contact message not found');
    if (dto.status !== undefined) {
      message.status = dto.status;
      message.handledById = actorId;
      message.handledAt = new Date();
    }
    const saved = await this.messages.save(message);
    await this.audit.log({
      actorId,
      action: 'update',
      entityType: 'contact_message',
      entityId: saved.id,
      summary: `Traitement du message de ${saved.name} (statut : ${saved.status})`,
    });
    return saved;
  }
}
