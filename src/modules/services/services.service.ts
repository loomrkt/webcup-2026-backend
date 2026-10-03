import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationsService } from '../communications/communications.service';
import { Alert } from '../communications/entities/alert.entity';
import { I18nService } from '../i18n/i18n.service';
import { Request } from '../requests/entities/request.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto/services.dto';
import { Service } from './entities/service.entity';

const LOCALIZED_FIELDS = ['name', 'description'];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    @InjectRepository(Request)
    private readonly requests: Repository<Request>,
    private readonly i18n: I18nService,
    private readonly communications: CommunicationsService,
  ) {}

  private async attachTranslations(
    service: Service,
    locale?: string,
  ): Promise<Service & { translations: Record<string, string> }> {
    const translations = locale
      ? await this.i18n.getLocalized(
          'service',
          service.id,
          locale,
          LOCALIZED_FIELDS,
        )
      : {};
    return { ...service, translations };
  }

  private async attachTranslationsMany(
    services: Service[],
    locale?: string,
  ): Promise<Array<Service & { translations: Record<string, string> }>> {
    if (!locale) return services.map((s) => ({ ...s, translations: {} }));
    return Promise.all(services.map((s) => this.attachTranslations(s, locale)));
  }

  async listPublic(
    locale?: string,
  ): Promise<Array<Service & { translations: Record<string, string> }>> {
    const services = await this.services.find({
      where: { active: true },
      order: { order: 'ASC', name: 'ASC' },
    });
    return this.attachTranslationsMany(services, locale);
  }

  async getPublic(
    id: string,
    locale?: string,
  ): Promise<Service & { translations: Record<string, string> }> {
    const service = await this.services.findOne({
      where: { id, active: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    return this.attachTranslations(service, locale);
  }

  async listFeatured(
    locale?: string,
  ): Promise<Array<Service & { translations: Record<string, string> }>> {
    const services = await this.services.find({
      where: { active: true, featured: true },
      order: { featuredOrder: 'ASC', name: 'ASC' },
    });
    return this.attachTranslationsMany(services, locale);
  }

  async listPopular(
    limit: number,
    locale?: string,
  ): Promise<Array<Service & { translations: Record<string, string> }>> {
    const rows = await this.services
      .createQueryBuilder('service')
      .leftJoin(
        Request,
        'request',
        'request.service_id = service.id AND request.status <> :rejected',
        { rejected: 'rejected' },
      )
      .where('service.active = :active', { active: true })
      .groupBy('service.id')
      .addSelect('COUNT(request.id)', 'usage_count')
      .orderBy('"usage_count"', 'DESC')
      .addOrderBy('service.order', 'ASC')
      .limit(Math.max(1, Math.min(limit, 50)))
      .getRawAndEntities();
    return this.attachTranslationsMany(rows.entities, locale);
  }

  async listAll(): Promise<Service[]> {
    return this.services.find({ order: { order: 'ASC', name: 'ASC' } });
  }

  /** Recherche par nom/catégorie/description avec score de pertinence (F32). */
  async search(
    q: string,
    limit: number,
    locale?: string,
  ): Promise<{
    items: Array<Service & { translations: Record<string, string> }>;
    attention: Alert[];
  }> {
    const term = normalizeText(q.trim());
    const candidates = await this.services.find({
      where: { active: true },
      order: { order: 'ASC', name: 'ASC' },
    });
    const scored = candidates
      .map((service) => {
        const name = normalizeText(service.name);
        const category = normalizeText(service.category ?? '');
        const description = normalizeText(service.description ?? '');
        let score = Infinity;
        if (name === term) score = 0;
        else if (name.startsWith(term)) score = 1;
        else if (name.includes(term)) score = 2;
        else if (category.includes(term)) score = 3;
        else if (description.includes(term)) score = 4;
        return { service, score };
      })
      .filter((entry) => entry.score !== Infinity)
      .sort((a, b) => a.score - b.score || a.service.order - b.service.order)
      .slice(0, Math.max(1, Math.min(limit, 50)))
      .map((entry) => entry.service);
    const items = await this.attachTranslationsMany(scored, locale);
    const attention = await this.communications.listActiveAlerts();
    return { items, attention };
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
        featured: dto.featured ?? false,
        featuredOrder: dto.featuredOrder ?? 0,
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
    if (dto.featured !== undefined) service.featured = dto.featured;
    if (dto.featuredOrder !== undefined) {
      service.featuredOrder = dto.featuredOrder;
    }
    return this.services.save(service);
  }

  async delete(id: string): Promise<void> {
    const service = await this.services.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    await this.services.delete({ id });
  }
}
