import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationsService } from '../communications/communications.service';
import { Alert } from '../communications/entities/alert.entity';
import { I18nService } from '../i18n/i18n.service';
import { AuditService } from '../audit/audit.service';
import { Request } from '../requests/entities/request.entity';
import {
  CreateServiceDto,
  SetServiceAvailabilityDto,
  UpdateServiceDto,
} from './dto/services.dto';
import { Service } from './entities/service.entity';
import { ServiceStatusHistory } from './entities/service-status-history.entity';

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

/** F64 — état lisible par l'habitant : opérationnel / perturbé / indisponible. */
function availabilityOf(service: Service): {
  code: 'operational' | 'degraded' | 'unavailable';
  label: string;
  nextAction: string;
} {
  const unavailable = !service.active || service.status === 'incident';
  const degraded = service.status === 'maintenance';
  if (unavailable) {
    return {
      code: 'unavailable',
      label: 'Indisponible',
      nextAction: service.alternativeServiceId
        ? 'Ce service est temporairement indisponible. Un service alternatif est proposé ci-dessous.'
        : 'Ce service est temporairement indisponible. Réessayez plus tard ou contactez la mairie.',
    };
  }
  if (degraded) {
    return {
      code: 'degraded',
      label: 'Perturbé',
      nextAction:
        'Le service est ralenti ou partiellement accessible. Vous pouvez tout de même effectuer votre démarche.',
    };
  }
  return {
    code: 'operational',
    label: 'Opérationnel',
    nextAction: 'Vous pouvez effectuer votre démarche en ligne.',
  };
}

/** Champs réduits en mode léger (F62). */
const LIGHT_SELECT = {
  id: true,
  name: true,
  slug: true,
  icon: true,
  category: true,
  status: true,
  active: true,
} as const;

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    @InjectRepository(Request)
    private readonly requests: Repository<Request>,
    @InjectRepository(ServiceStatusHistory)
    private readonly statusHistory: Repository<ServiceStatusHistory>,
    private readonly i18n: I18nService,
    private readonly communications: CommunicationsService,
    private readonly audit: AuditService,
  ) {}

  private attachAvailability(
    service: Service,
  ): Service & { availability: ReturnType<typeof availabilityOf> } {
    return { ...service, availability: availabilityOf(service) };
  }

  private attachAvailabilityMany(
    services: Service[],
  ): Array<Service & { availability: ReturnType<typeof availabilityOf> }> {
    return services.map((s) => this.attachAvailability(s));
  }

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

  async listPublic(locale?: string, light = false): Promise<Service[]> {
    const services = await this.services.find({
      where: { active: true },
      relations: { alternativeService: true },
      select: light ? LIGHT_SELECT : undefined,
      order: { order: 'ASC', name: 'ASC' },
    });
    if (light) return services;
    const withAvailability = this.attachAvailabilityMany(services);
    return this.attachTranslationsMany(withAvailability, locale);
  }

  /** Vue d'ensemble du Service Status Center (F38). */
  async statusSummary() {
    const impacted = await this.services.find({
      where: [{ status: 'maintenance' }, { status: 'incident' }],
      relations: { alternativeService: true },
      order: { name: 'ASC' },
    });
    return {
      healthy: await this.services.count({
        where: { status: 'available', active: true },
      }),
      maintenance: this.attachAvailabilityMany(
        impacted.filter((s) => s.status === 'maintenance'),
      ),
      incident: this.attachAvailabilityMany(
        impacted.filter((s) => s.status === 'incident'),
      ),
    };
  }

  async getPublic(
    id: string,
    locale?: string,
  ): Promise<Service & { translations: Record<string, string> }> {
    const service = await this.services.findOne({
      where: { id, active: true },
      relations: { alternativeService: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    const withAvailability = this.attachAvailability(service);
    return this.attachTranslations(withAvailability, locale);
  }

  async listFeatured(locale?: string, light = false): Promise<Service[]> {
    const services = await this.services.find({
      where: { active: true, featured: true },
      select: light ? LIGHT_SELECT : undefined,
      order: { featuredOrder: 'ASC', name: 'ASC' },
    });
    if (light) return services;
    return this.attachTranslationsMany(
      this.attachAvailabilityMany(services),
      locale,
    );
  }

  async listPopular(
    limit: number,
    locale?: string,
    light = false,
  ): Promise<Service[]> {
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
    if (light) {
      return rows.entities.map((e) =>
        Object.fromEntries(Object.keys(LIGHT_SELECT).map((k) => [k, e[k]])),
      ) as Service[];
    }
    return this.attachTranslationsMany(
      this.attachAvailabilityMany(rows.entities),
      locale,
    );
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
    const items = await this.attachTranslationsMany(
      this.attachAvailabilityMany(scored),
      locale,
    );
    const attention = await this.communications.listActiveAlerts();
    return { items, attention };
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const slug = dto.slug?.trim().toLowerCase() ?? slugify(dto.name);
    const existing = await this.services.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" already exists`);
    }
    const created = await this.services.save(
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
        status: dto.status ?? 'available',
        statusMessage: dto.statusMessage ?? null,
        resumeAt: dto.resumeAt ? new Date(dto.resumeAt) : null,
        alternativeServiceId: dto.alternativeServiceId ?? null,
      }),
    );
    await this.audit.log({
      action: 'create',
      entityType: 'service',
      entityId: created.id,
      summary: `Création du service « ${created.name} »`,
    });
    return created;
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
    if (dto.status !== undefined) service.status = dto.status;
    if (dto.statusMessage !== undefined) {
      service.statusMessage = dto.statusMessage ?? null;
    }
    if (dto.resumeAt !== undefined) {
      service.resumeAt = dto.resumeAt ? new Date(dto.resumeAt) : null;
    }
    if (dto.alternativeServiceId !== undefined) {
      service.alternativeServiceId = dto.alternativeServiceId ?? null;
    }
    const statusChanged =
      (dto.status !== undefined && dto.status !== service.status) ||
      (dto.active !== undefined && dto.active !== service.active);
    const saved = await this.services.save(service);
    if (statusChanged) {
      await this.recordStatusChange(saved, null, dto.statusMessage ?? null);
    }
    await this.audit.log({
      action: 'update',
      entityType: 'service',
      entityId: saved.id,
      summary: `Modification du service « ${saved.name} » (statut : ${saved.status})`,
      after: { name: saved.name, status: saved.status, active: saved.active },
    });
    return saved;
  }

  /**
   * F63 — désactivation/réactivation rapide d'un service par un administrateur,
   * avec motif obligatoire et journalisation.
   */
  async setAvailability(
    actorId: string,
    id: string,
    dto: SetServiceAvailabilityDto,
  ): Promise<Service> {
    const service = await this.services.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    service.active = dto.available;
    service.status = dto.status ?? (dto.available ? 'available' : 'incident');
    service.statusMessage = dto.reason?.trim() ? dto.reason.trim() : null;
    if (dto.available && service.status === 'available') {
      service.resumeAt = null;
    }
    const saved = await this.services.save(service);
    await this.recordStatusChange(saved, actorId, service.statusMessage);
    await this.audit.log({
      actorId,
      action: dto.available ? 'enable' : 'disable',
      entityType: 'service',
      entityId: saved.id,
      summary: `${dto.available ? 'Activation' : 'Désactivation'} du service « ${saved.name} » (statut : ${saved.status})${service.statusMessage ? ` — motif : ${service.statusMessage}` : ''}`,
      after: { active: saved.active, status: saved.status },
    });
    return saved;
  }

  /** Journal des changements d'état d'un service (F63). */
  async getStatusHistory(id: string): Promise<ServiceStatusHistory[]> {
    const service = await this.services.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    return this.statusHistory.find({
      where: { serviceId: id },
      relations: { changedBy: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async recordStatusChange(
    service: Service,
    changedById: string | null,
    reason: string | null,
  ): Promise<void> {
    try {
      await this.statusHistory.save(
        this.statusHistory.create({
          serviceId: service.id,
          active: service.active,
          status: service.status,
          reason: reason ?? null,
          changedById,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to record status change for service ${service.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async delete(id: string): Promise<void> {
    const service = await this.services.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    await this.services.delete({ id });
    await this.audit.log({
      action: 'delete',
      entityType: 'service',
      entityId: id,
      summary: `Suppression du service « ${service.name} »`,
    });
  }
}
