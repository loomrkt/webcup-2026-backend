import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateServiceDto, UpdateServiceDto } from './dto/services.dto';
import { Service } from './entities/service.entity';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
  ) {}

  async listPublic(): Promise<Service[]> {
    return this.services.find({
      where: { active: true },
      order: { order: 'ASC', name: 'ASC' },
    });
  }

  async getPublic(id: string): Promise<Service> {
    const service = await this.services.findOne({
      where: { id, active: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async listAll(): Promise<Service[]> {
    return this.services.find({ order: { order: 'ASC', name: 'ASC' } });
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const slug = dto.slug?.trim().toLowerCase() ?? slugify(dto.name);
    const existing = await this.services.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" already exists`);
    }
    return this.services.save(
      this.services.create({
        name: dto.name.trim(),
        slug,
        description: dto.description ?? null,
        category: dto.category ?? null,
        icon: dto.icon ?? null,
        order: dto.order ?? 0,
        active: dto.active ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.services.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    if (dto.name !== undefined) service.name = dto.name.trim();
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      const clash = await this.services.findOne({ where: { slug } });
      if (clash && clash.id !== id) {
        throw new ConflictException(`Slug "${slug}" already exists`);
      }
      service.slug = slug;
    }
    if (dto.description !== undefined) {
      service.description = dto.description ?? null;
    }
    if (dto.category !== undefined) service.category = dto.category ?? null;
    if (dto.icon !== undefined) service.icon = dto.icon ?? null;
    if (dto.order !== undefined) service.order = dto.order;
    if (dto.active !== undefined) service.active = dto.active;
    return this.services.save(service);
  }

  async delete(id: string): Promise<void> {
    const service = await this.services.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    await this.services.delete({ id });
  }
}
