import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  CreateTranslationDto,
  ListTranslationsQueryDto,
  UpdateTranslationDto,
} from './dto/i18n.dto';
import { Translation } from './entities/translation.entity';

export const FALLBACK_LOCALE = 'fr';

@Injectable()
export class I18nService {
  constructor(
    @InjectRepository(Translation)
    private readonly translations: Repository<Translation>,
  ) {}

  /** Renvoie { field: value } pour une entité et une locale (repli sur la locale par défaut). */
  async getMap(
    entityType: string,
    entityId: string | null,
    locale: string | undefined,
  ): Promise<Record<string, string>> {
    const target = locale ?? FALLBACK_LOCALE;
    const rows = await this.translations.find({
      where: {
        entityType,
        entityId: entityId ?? IsNull(),
        locale: target,
      },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.field] = row.value;
    if (target !== FALLBACK_LOCALE) {
      const fallback = await this.translations.find({
        where: {
          entityType,
          entityId: entityId ?? IsNull(),
          locale: FALLBACK_LOCALE,
        },
      });
      for (const row of fallback) {
        if (map[row.field] === undefined) map[row.field] = row.value;
      }
    }
    return map;
  }

  /** Renvoie un sous-ensemble de champs localisés (ex. { name, description }). */
  async getLocalized(
    entityType: string,
    entityId: string | null,
    locale: string | undefined,
    fields: string[],
  ): Promise<Record<string, string>> {
    const map = await this.getMap(entityType, entityId, locale);
    const out: Record<string, string> = {};
    for (const field of fields) {
      if (map[field] !== undefined) out[field] = map[field];
    }
    return out;
  }

  async listAll(query: ListTranslationsQueryDto): Promise<Translation[]> {
    return this.translations.find({
      where: {
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.locale ? { locale: query.locale } : {}),
      },
      order: { entityType: 'ASC', locale: 'ASC', field: 'ASC' },
    });
  }

  async upsert(dto: CreateTranslationDto): Promise<Translation> {
    const existing = await this.translations.findOne({
      where: {
        entityType: dto.entityType,
        entityId: dto.entityId ?? IsNull(),
        field: dto.field,
        locale: dto.locale,
      },
    });
    if (existing) {
      existing.value = dto.value;
      return this.translations.save(existing);
    }
    return this.translations.save(
      this.translations.create({
        entityType: dto.entityType,
        entityId: dto.entityId ?? null,
        field: dto.field,
        locale: dto.locale,
        value: dto.value,
      }),
    );
  }

  async update(id: string, dto: UpdateTranslationDto): Promise<Translation> {
    const translation = await this.translations.findOne({ where: { id } });
    if (!translation) throw new NotFoundException('Translation not found');
    if (dto.value !== undefined) translation.value = dto.value;
    return this.translations.save(translation);
  }

  async remove(id: string): Promise<void> {
    const translation = await this.translations.findOne({ where: { id } });
    if (!translation) throw new NotFoundException('Translation not found');
    await this.translations.delete({ id });
  }
}
