import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateContactMessageDto,
  UpdateContactMessageDto,
} from './dto/contact.dto';
import { ContactMessage } from './entities/contact-message.entity';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly messages: Repository<ContactMessage>,
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
    return this.messages.save(message);
  }
}
