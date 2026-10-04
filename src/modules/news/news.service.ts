import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePublicationDto, UpdatePublicationDto } from './dto/news.dto';
import { Publication } from './entities/publication.entity';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(Publication)
    private readonly publications: Repository<Publication>,
  ) {}

  async listPublic(): Promise<Publication[]> {
    return this.publications.find({
      where: { published: true },
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getPublic(id: string): Promise<Publication> {
    const publication = await this.publications.findOne({
      where: { id, published: true },
    });
    if (!publication) throw new NotFoundException('Publication not found');
    return publication;
  }

  async listAll(): Promise<Publication[]> {
    return this.publications.find({
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(
    actorId: string,
    dto: CreatePublicationDto,
  ): Promise<Publication> {
    const slug = dto.slug?.trim().toLowerCase() ?? slugify(dto.title);
    const existing = await this.publications.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" already exists`);
    }
    const published = dto.published ?? false;
    return this.publications.save(
      this.publications.create({
        title: dto.title.trim(),
        slug,
        summary: dto.summary ?? null,
        content: dto.content,
        coverImage: dto.coverImage ?? null,
        published,
        publishedAt: published ? new Date() : null,
        authorId: actorId,
      }),
    );
  }

  async update(id: string, dto: UpdatePublicationDto): Promise<Publication> {
    const publication = await this.publications.findOne({ where: { id } });
    if (!publication) throw new NotFoundException('Publication not found');
    if (dto.title !== undefined) publication.title = dto.title.trim();
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      const clash = await this.publications.findOne({ where: { slug } });
      if (clash && clash.id !== id) {
        throw new ConflictException(`Slug "${slug}" already exists`);
      }
      publication.slug = slug;
    }
    if (dto.summary !== undefined) {
      publication.summary = dto.summary ?? null;
    }
    if (dto.content !== undefined) publication.content = dto.content;
    if (dto.coverImage !== undefined) {
      publication.coverImage = dto.coverImage ?? null;
    }
    if (dto.published !== undefined) {
      const wasUnpublished = !publication.published;
      publication.published = dto.published;
      if (dto.published && wasUnpublished) {
        publication.publishedAt = new Date();
      }
    }
    return this.publications.save(publication);
  }

  async delete(id: string): Promise<void> {
    const publication = await this.publications.findOne({ where: { id } });
    if (!publication) throw new NotFoundException('Publication not found');
    await this.publications.delete({ id });
  }
}
