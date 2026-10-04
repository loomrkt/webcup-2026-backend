import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  CreateGlossaryTermDto,
  ListGlossaryQueryDto,
  UpdateGlossaryTermDto,
} from './dto/glossary.dto';
import { GlossaryTerm } from './entities/glossary-term.entity';

@Injectable()
export class GlossaryService {
  constructor(
    @InjectRepository(GlossaryTerm)
    private readonly terms: Repository<GlossaryTerm>,
  ) {}

  async listPublic(query: ListGlossaryQueryDto): Promise<GlossaryTerm[]> {
    const where: Record<string, unknown> = { active: true };
    if (query.q) where.term = ILike(`%${query.q.trim()}%`);
    return this.terms.find({
      where,
      order: { order: 'ASC', term: 'ASC' },
      take: Math.min(query.limit ?? 100, 200),
    });
  }

  async listAll(): Promise<GlossaryTerm[]> {
    return this.terms.find({ order: { order: 'ASC', term: 'ASC' } });
  }

  async create(dto: CreateGlossaryTermDto): Promise<GlossaryTerm> {
    return this.terms.save(
      this.terms.create({
        term: dto.term.trim().toLowerCase(),
        definition: dto.definition,
        category: dto.category ?? null,
        order: dto.order ?? 0,
        active: dto.active ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateGlossaryTermDto): Promise<GlossaryTerm> {
    const term = await this.terms.findOne({ where: { id } });
    if (!term) throw new NotFoundException('Glossary term not found');
    if (dto.term !== undefined) term.term = dto.term.trim().toLowerCase();
    if (dto.definition !== undefined) term.definition = dto.definition;
    if (dto.category !== undefined) term.category = dto.category ?? null;
    if (dto.order !== undefined) term.order = dto.order;
    if (dto.active !== undefined) term.active = dto.active;
    return this.terms.save(term);
  }

  async remove(id: string): Promise<void> {
    const term = await this.terms.findOne({ where: { id } });
    if (!term) throw new NotFoundException('Glossary term not found');
    await this.terms.delete({ id });
  }
}
