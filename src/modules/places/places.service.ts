import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Service } from '../services/entities/service.entity';
import {
  CreatePlaceDto,
  ListPlacesQueryDto,
  UpdatePlaceDto,
} from './dto/places.dto';
import { Place } from './entities/place.entity';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const DEMO_PLACES: Array<{
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  hours: string;
  emergency: boolean;
}> = [
  {
    name: 'Hôpital central de Nova Terra',
    category: 'sante',
    address: '12 Avenue des Soins, Centre-ville',
    latitude: 48.8566,
    longitude: 2.3522,
    phone: '112',
    hours: '24h/24 — Urgences ouvertes en continu',
    emergency: true,
  },
  {
    name: 'Centre médical du Quartier Sud',
    category: 'sante',
    address: '8 Rue des Lilas, Quartier Sud',
    latitude: 48.8506,
    longitude: 2.3452,
    phone: '02 99 00 11 22',
    hours: 'Lun–Ven 8h–19h, Sam 9h–13h',
    emergency: false,
  },
  {
    name: 'Commissariat de police',
    category: 'securite',
    address: '2 Place de la Sûreté, Centre-ville',
    latitude: 48.8596,
    longitude: 2.3492,
    phone: '17',
    hours: '24h/24',
    emergency: true,
  },
  {
    name: 'Caserne des pompiers',
    category: 'securite',
    address: '45 Rue des Casernes, Quartier Nord',
    latitude: 48.8666,
    longitude: 2.3552,
    phone: '18',
    hours: '24h/24',
    emergency: true,
  },
  {
    name: 'Mairie de Nova Terra',
    category: 'administration',
    address: '1 Place de l’Hôtel de Ville, Centre-ville',
    latitude: 48.8562,
    longitude: 2.3526,
    phone: '02 99 00 10 10',
    hours: 'Lun–Ven 8h30–17h30',
    emergency: false,
  },
  {
    name: 'Maison des associations',
    category: 'associations',
    address: '5 Rue des Solidarités, Quartier Est',
    latitude: 48.8622,
    longitude: 2.3622,
    phone: '02 99 00 12 34',
    hours: 'Mar–Sam 10h–18h',
    emergency: false,
  },
];

@Injectable()
export class PlacesService implements OnModuleInit {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    @InjectRepository(Place)
    private readonly places: Repository<Place>,
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if ((this.config.get<string>('PLACES_SEED_DEMO') ?? 'true') !== 'true') {
      return;
    }
    try {
      let inserted = 0;
      for (const demo of DEMO_PLACES) {
        const existing = await this.places.findOneBy({ name: demo.name });
        if (existing) continue;
        await this.places.save(this.places.create(demo));
        inserted += 1;
      }
      if (inserted > 0) {
        this.logger.log(`Places demo data seeded (${inserted} new places)`);
      }
    } catch (error) {
      this.logger.warn(
        `Places demo seed skipped (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }

  async list(query: ListPlacesQueryDto) {
    const qb = this.places.createQueryBuilder('place');
    qb.where('place.active = :active', { active: true });
    if (query.category) {
      qb.andWhere('place.category = :category', { category: query.category });
    }
    if (query.emergency === 'true') {
      qb.andWhere('place.emergency = true');
    } else if (query.emergency === 'false') {
      qb.andWhere('place.emergency = false');
    }
    if (query.lat !== undefined && query.lng !== undefined && query.radiusKm) {
      const kmPerDeg = 111.0;
      const latDelta = query.radiusKm / kmPerDeg;
      const lngDelta =
        query.radiusKm / (kmPerDeg * Math.cos((query.lat * Math.PI) / 180));
      qb.andWhere('place.latitude BETWEEN :latMin AND :latMax', {
        latMin: query.lat - latDelta,
        latMax: query.lat + latDelta,
      }).andWhere('place.longitude BETWEEN :lngMin AND :lngMax', {
        lngMin: query.lng - lngDelta,
        lngMax: query.lng + lngDelta,
      });
    }
    qb.orderBy('place.name', 'ASC')
      .leftJoinAndSelect('place.service', 'service')
      .limit(Math.min(query.limit ?? 50, 100));
    const places = await qb.getMany();
    if (!query.q) return places;
    const term = normalizeText(query.q.trim());
    return places.filter((place) =>
      normalizeText(
        [place.name, place.category, place.address].filter(Boolean).join(' '),
      ).includes(term),
    );
  }

  async get(id: string): Promise<Place> {
    const place = await this.places.findOne({
      where: { id },
      relations: { service: true },
    });
    if (!place) throw new NotFoundException('Place not found');
    return place;
  }

  async listAll(): Promise<Place[]> {
    return this.places.find({
      relations: { service: true },
      order: { name: 'ASC' },
    });
  }

  async create(actorId: string, dto: CreatePlaceDto): Promise<Place> {
    const place = await this.places.save(
      this.places.create({
        name: dto.name.trim(),
        category: dto.category.trim(),
        address: dto.address ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        phone: dto.phone ?? null,
        hours: dto.hours ?? null,
        description: dto.description ?? null,
        emergency: dto.emergency === 'true',
        serviceId: dto.serviceId ?? null,
        active: dto.active !== 'false',
      }),
    );
    await this.audit.log({
      actorId,
      action: 'create',
      entityType: 'place',
      entityId: place.id,
      summary: `Création du lieu « ${place.name} »`,
    });
    return place;
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdatePlaceDto,
  ): Promise<Place> {
    const place = await this.places.findOne({ where: { id } });
    if (!place) throw new NotFoundException('Place not found');
    const before = {
      name: place.name,
      category: place.category,
      emergency: place.emergency,
    };
    if (dto.name !== undefined) place.name = dto.name.trim();
    if (dto.category !== undefined) place.category = dto.category.trim();
    if (dto.address !== undefined) place.address = dto.address ?? null;
    if (dto.latitude !== undefined) place.latitude = dto.latitude ?? null;
    if (dto.longitude !== undefined) place.longitude = dto.longitude ?? null;
    if (dto.phone !== undefined) place.phone = dto.phone ?? null;
    if (dto.hours !== undefined) place.hours = dto.hours ?? null;
    if (dto.description !== undefined)
      place.description = dto.description ?? null;
    if (dto.emergency !== undefined) place.emergency = dto.emergency === 'true';
    if (dto.serviceId !== undefined) place.serviceId = dto.serviceId ?? null;
    if (dto.active !== undefined) place.active = dto.active !== 'false';
    const saved = await this.places.save(place);
    await this.audit.log({
      actorId,
      action: 'update',
      entityType: 'place',
      entityId: saved.id,
      summary: `Modification du lieu « ${saved.name} »`,
      before,
      after: {
        name: saved.name,
        category: saved.category,
        emergency: saved.emergency,
      },
    });
    return saved;
  }

  async remove(actorId: string, id: string): Promise<void> {
    const place = await this.places.findOne({ where: { id } });
    if (!place) throw new NotFoundException('Place not found');
    await this.places.delete({ id });
    await this.audit.log({
      actorId,
      action: 'delete',
      entityType: 'place',
      entityId: id,
      summary: `Suppression du lieu « ${place.name} »`,
    });
  }
}
