import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CommunicationsService } from '../communications/communications.service';
import { RbacService } from '../rbac/rbac.service';
import {
  CreateConsultationDto,
  CreateIdeaDto,
  CreateProjectDto,
  ListQueryDto,
  RespondConsultationDto,
  SubmitFeedbackDto,
  UpdateConsultationDto,
  UpdateIdeaDto,
  UpdateProjectDto,
} from './dto/civic.dto';
import { CitizenIdea } from './entities/citizen-idea.entity';
import { CityProject } from './entities/city-project.entity';
import { Consultation } from './entities/consultation.entity';
import { ConsultationResponse } from './entities/consultation-response.entity';
import {
  FEEDBACK_SENTIMENTS,
  ProjectFeedback,
} from './entities/project-feedback.entity';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isOpen(consultation: Consultation): boolean {
  const now = new Date();
  return (
    consultation.status === 'open' &&
    (!consultation.startsAt || consultation.startsAt <= now) &&
    (!consultation.endsAt || consultation.endsAt >= now)
  );
}

const PROJECT_LIGHT_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  progress: true,
  category: true,
  location: true,
  updatedAt: true,
} as const;

const CONSULTATION_LIGHT_SELECT = {
  id: true,
  title: true,
  question: true,
  status: true,
  startsAt: true,
  endsAt: true,
} as const;

const IDEA_STATUS_LABELS: Record<string, string> = {
  received: 'Reçue',
  studied: 'Étudiée',
  retained: 'Retenue',
  rejected: 'Écartée',
  realized: 'Réalisée',
};

const IDEA_STATUS_ACTIONS: Record<string, string> = {
  received: 'Votre idée a bien été enregistrée.',
  studied: 'Votre idée est actuellement étudiée par les services de la ville.',
  retained: 'Votre idée a été retenue. Elle sera intégrée aux travaux à venir.',
  rejected:
    'Votre idée n’a pas été retenue. Merci pour votre contribution : elle reste visible sur la plateforme.',
  realized: 'Votre idée a été réalisée. Merci pour votre contribution !',
};

@Injectable()
export class CivicService {
  private readonly logger = new Logger(CivicService.name);

  constructor(
    @InjectRepository(CityProject)
    private readonly projects: Repository<CityProject>,
    @InjectRepository(Consultation)
    private readonly consultations: Repository<Consultation>,
    @InjectRepository(ConsultationResponse)
    private readonly responses: Repository<ConsultationResponse>,
    @InjectRepository(ProjectFeedback)
    private readonly feedbacks: Repository<ProjectFeedback>,
    @InjectRepository(CitizenIdea)
    private readonly ideas: Repository<CitizenIdea>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly rbac: RbacService,
    private readonly communications: CommunicationsService,
  ) {}

  private async hasPermission(userId: string, permission: string) {
    if (await this.rbac.isSuperAdmin(userId)) return true;
    const permissions = await this.rbac.effectivePermissions(userId);
    return permissions.includes(permission);
  }

  private notify(
    userId: string,
    title: string,
    body: string,
    payload: Record<string, unknown>,
  ): void {
    void this.communications
      .notify(userId, 'system', title, body, 'normal', payload)
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to notify user ${userId}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      });
  }

  // ─── F67 : catalogue des projets ──────────────────────────────────────────

  async listProjects(light = false): Promise<Partial<CityProject>[]> {
    return this.projects.find({
      select: light ? PROJECT_LIGHT_SELECT : undefined,
      order: { updatedAt: 'DESC' },
    });
  }

  async getProject(id: string): Promise<CityProject> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async createProject(dto: CreateProjectDto): Promise<CityProject> {
    const slug = dto.slug?.trim().toLowerCase() ?? slugify(dto.title);
    const existing = await this.projects.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" already exists`);
    }
    return this.projects.save(
      this.projects.create({
        title: dto.title.trim(),
        slug,
        description: dto.description ?? null,
        status: dto.status ?? 'planned',
        progress: dto.progress ?? 0,
        category: dto.category ?? null,
        location: dto.location ?? null,
        responsible: dto.responsible ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        nextSteps: dto.nextSteps ?? null,
      }),
    );
  }

  async updateProject(id: string, dto: UpdateProjectDto): Promise<CityProject> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (dto.title !== undefined) project.title = dto.title.trim();
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      const clash = await this.projects.findOne({ where: { slug } });
      if (clash && clash.id !== id) {
        throw new ConflictException(`Slug "${slug}" already exists`);
      }
      project.slug = slug;
    }
    if (dto.description !== undefined) {
      project.description = dto.description ?? null;
    }
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.progress !== undefined) project.progress = dto.progress;
    if (dto.category !== undefined) project.category = dto.category ?? null;
    if (dto.location !== undefined) project.location = dto.location ?? null;
    if (dto.responsible !== undefined) {
      project.responsible = dto.responsible ?? null;
    }
    if (dto.startDate !== undefined) project.startDate = dto.startDate ?? null;
    if (dto.endDate !== undefined) project.endDate = dto.endDate ?? null;
    if (dto.nextSteps !== undefined) {
      project.nextSteps = dto.nextSteps ?? null;
    }
    return this.projects.save(project);
  }

  async deleteProject(id: string): Promise<void> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    await this.projects.delete({ id });
  }

  // ─── F66 : avis sur un projet ─────────────────────────────────────────────

  async submitFeedback(
    userId: string,
    projectId: string,
    dto: SubmitFeedbackDto,
  ): Promise<ProjectFeedback> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (!dto.sentiment && !dto.comment) {
      throw new BadRequestException('Provide a sentiment or a comment');
    }
    const existing = await this.feedbacks.findOne({
      where: { projectId, userId },
    });
    const saved = await this.feedbacks.save(
      existing
        ? this.feedbacks.merge(existing, {
            sentiment: dto.sentiment ?? existing.sentiment,
            comment: dto.comment !== undefined ? dto.comment : existing.comment,
            updatedAt: new Date(),
          })
        : this.feedbacks.create({
            projectId,
            userId,
            sentiment: dto.sentiment ?? null,
            comment: dto.comment ?? null,
          }),
    );
    this.notify(
      userId,
      'Avis enregistré',
      `Merci ! Votre avis sur le projet « ${project.title} » a bien été pris en compte.`,
      {
        entityType: 'project',
        entityId: project.id,
        url: `/projects/${project.id}`,
      },
    );
    return saved;
  }

  async myFeedback(
    userId: string,
    projectId: string,
  ): Promise<ProjectFeedback | null> {
    return this.feedbacks.findOne({ where: { projectId, userId } });
  }

  async listFeedback(
    actorId: string,
    projectId: string,
  ): Promise<ProjectFeedback[]> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (await this.hasPermission(actorId, 'feedback.manage')) {
      return this.feedbacks.find({
        where: { projectId },
        relations: { user: true },
        order: { createdAt: 'DESC' },
      });
    }
    return this.feedbacks.find({ where: { projectId, userId: actorId } });
  }

  async feedbackSummary(projectId: string): Promise<{
    total: number;
    bySentiment: Record<string, number>;
  }> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const rows = await this.feedbacks
      .createQueryBuilder('feedback')
      .select('feedback.sentiment', 'sentiment')
      .addSelect('COUNT(*)', 'count')
      .where('feedback.project_id = :projectId', { projectId })
      .groupBy('feedback.sentiment')
      .getRawMany<{ sentiment: string | null; count: string }>();
    const bySentiment: Record<string, number> = {};
    for (const sentiment of FEEDBACK_SENTIMENTS) bySentiment[sentiment] = 0;
    for (const row of rows) {
      if (row.sentiment && bySentiment[row.sentiment] !== undefined) {
        bySentiment[row.sentiment] = Number(row.count);
      }
    }
    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
    return { total, bySentiment };
  }

  // ─── F65 : consultations citoyennes ───────────────────────────────────────

  async listConsultations(light = false): Promise<Partial<Consultation>[]> {
    const consultations = await this.consultations.find({
      select: light ? CONSULTATION_LIGHT_SELECT : undefined,
      order: { endsAt: 'ASC', createdAt: 'DESC' },
    });
    return consultations.filter((c) => isOpen(c));
  }

  async getConsultation(id: string): Promise<Consultation> {
    const consultation = await this.consultations.findOne({ where: { id } });
    if (!consultation) throw new NotFoundException('Consultation not found');
    return consultation;
  }

  async listAllConsultations(): Promise<Consultation[]> {
    return this.consultations.find({
      relations: { createdBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createConsultation(
    actorId: string,
    dto: CreateConsultationDto,
  ): Promise<Consultation> {
    const status = dto.status ?? 'draft';
    if (status === 'open' && dto.endsAt && new Date(dto.endsAt) < new Date()) {
      throw new BadRequestException('endsAt must be in the future');
    }
    return this.consultations.save(
      this.consultations.create({
        title: dto.title.trim(),
        question: dto.question.trim(),
        description: dto.description ?? null,
        choices: [...new Set(dto.choices.map((c) => c.trim()))],
        allowComments: dto.allowComments ?? true,
        resultsPublic: dto.resultsPublic ?? false,
        status,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        createdById: actorId,
      }),
    );
  }

  async updateConsultation(
    id: string,
    dto: UpdateConsultationDto,
  ): Promise<Consultation> {
    const consultation = await this.consultations.findOne({ where: { id } });
    if (!consultation) throw new NotFoundException('Consultation not found');
    if (dto.title !== undefined) consultation.title = dto.title.trim();
    if (dto.question !== undefined) {
      consultation.question = dto.question.trim();
    }
    if (dto.description !== undefined) {
      consultation.description = dto.description ?? null;
    }
    if (dto.choices !== undefined) {
      consultation.choices = [...new Set(dto.choices.map((c) => c.trim()))];
    }
    if (dto.allowComments !== undefined) {
      consultation.allowComments = dto.allowComments;
    }
    if (dto.resultsPublic !== undefined) {
      consultation.resultsPublic = dto.resultsPublic;
    }
    if (dto.status !== undefined) consultation.status = dto.status;
    if (dto.startsAt !== undefined) {
      consultation.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    }
    if (dto.endsAt !== undefined) {
      consultation.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }
    return this.consultations.save(consultation);
  }

  async deleteConsultation(id: string): Promise<void> {
    const consultation = await this.consultations.findOne({ where: { id } });
    if (!consultation) throw new NotFoundException('Consultation not found');
    await this.consultations.delete({ id });
  }

  async respond(
    userId: string,
    consultationId: string,
    dto: RespondConsultationDto,
  ): Promise<{ response: ConsultationResponse; updated: boolean }> {
    const consultation = await this.consultations.findOne({
      where: { id: consultationId },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');
    if (!isOpen(consultation)) {
      throw new ForbiddenException(
        'Cette consultation est fermée. Elle n’accepte plus de réponse.',
      );
    }
    if (!consultation.choices.includes(dto.choice)) {
      throw new BadRequestException(
        `choice must be one of: ${consultation.choices.join(', ')}`,
      );
    }
    const existing = await this.responses.findOne({
      where: { consultationId, userId },
    });
    const response = existing
      ? await this.responses.save(
          this.responses.merge(existing, {
            choice: dto.choice,
            comment: dto.comment !== undefined ? dto.comment : existing.comment,
            updatedAt: new Date(),
          }),
        )
      : await this.responses.save(
          this.responses.create({
            consultationId,
            userId,
            choice: dto.choice,
            comment: dto.comment ?? null,
          }),
        );
    this.notify(
      userId,
      'Réponse enregistrée',
      `Merci ! Votre réponse à la consultation « ${consultation.title} » a bien été enregistrée.`,
      {
        entityType: 'consultation',
        entityId: consultation.id,
        url: `/consultations/${consultation.id}`,
      },
    );
    return { response, updated: existing !== null };
  }

  async results(
    actorId: string | null,
    consultationId: string,
  ): Promise<{
    consultationId: string;
    title: string;
    question: string;
    total: number;
    counts: Record<string, number>;
    comments: Array<{ comment: string | null; createdAt: Date }>;
  }> {
    const consultation = await this.consultations.findOne({
      where: { id: consultationId },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');
    const isAgent =
      actorId !== null &&
      (await this.hasPermission(actorId, 'consultations.manage'));
    if (!consultation.resultsPublic && !isAgent) {
      throw new ForbiddenException(
        'Les résultats de cette consultation ne sont pas publics',
      );
    }
    const rows = await this.responses
      .createQueryBuilder('response')
      .select('response.choice', 'choice')
      .addSelect('COUNT(*)', 'count')
      .where('response.consultation_id = :consultationId', { consultationId })
      .groupBy('response.choice')
      .getRawMany<{ choice: string; count: string }>();
    const counts: Record<string, number> = {};
    for (const choice of consultation.choices) counts[choice] = 0;
    for (const row of rows) {
      if (counts[row.choice] !== undefined)
        counts[row.choice] = Number(row.count);
    }
    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
    const comments = consultation.allowComments
      ? await this.responses.find({
          where: { consultationId },
          select: { comment: true, createdAt: true },
          order: { createdAt: 'DESC' },
          take: 200,
        })
      : [];
    return {
      consultationId: consultation.id,
      title: consultation.title,
      question: consultation.question,
      total,
      counts,
      comments,
    };
  }

  // ─── F68 : idées citoyennes ───────────────────────────────────────────────

  async createIdea(userId: string, dto: CreateIdeaDto): Promise<CitizenIdea> {
    const idea = await this.ideas.save(
      this.ideas.create({
        ref: this.generateIdeaRef(),
        userId,
        category: dto.category ?? null,
        title: dto.title.trim(),
        description: dto.description.trim(),
        status: 'received',
      }),
    );
    this.notify(
      userId,
      `Idée enregistrée ${idea.ref}`,
      `Merci ! Votre idée « ${idea.title} » a bien été prise en compte. Vous pourrez suivre son évolution depuis votre espace citoyen.`,
      { entityType: 'idea', entityId: idea.id, url: `/ideas/${idea.id}` },
    );
    return idea;
  }

  async myIdeas(
    userId: string,
    query: ListQueryDto,
  ): Promise<{
    items: CitizenIdea[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.paginateIdeas({ userId }, query);
  }

  async listIdeas(query: ListQueryDto): Promise<{
    items: CitizenIdea[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filters: Record<string, unknown> = {};
    if (query.status) filters.status = query.status;
    return this.paginateIdeas(filters, query);
  }

  async getIdea(id: string): Promise<CitizenIdea> {
    const idea = await this.ideas.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    return idea;
  }

  async updateIdea(
    actorId: string,
    id: string,
    dto: UpdateIdeaDto,
  ): Promise<CitizenIdea> {
    const idea = await this.ideas.findOne({ where: { id } });
    if (!idea) throw new NotFoundException('Idea not found');
    const statusChanged =
      dto.status !== undefined && dto.status !== idea.status;
    if (dto.status !== undefined) idea.status = dto.status;
    if (dto.adminNote !== undefined) idea.adminNote = dto.adminNote ?? null;
    const saved = await this.ideas.save(idea);
    if (statusChanged) {
      this.notify(
        idea.userId,
        `Votre idée ${idea.ref} : ${IDEA_STATUS_LABELS[idea.status] ?? idea.status}`,
        `${IDEA_STATUS_ACTIONS[idea.status] ?? ''}${idea.adminNote ? ` Retour de la ville : ${idea.adminNote}` : ''}`,
        { entityType: 'idea', entityId: idea.id, url: `/ideas/${idea.id}` },
      );
    }
    return saved;
  }

  async deleteIdea(id: string): Promise<void> {
    const idea = await this.ideas.findOne({ where: { id } });
    if (!idea) throw new NotFoundException('Idea not found');
    await this.ideas.delete({ id });
  }

  private generateIdeaRef(): string {
    return `IDEA-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
  }

  private async paginateIdeas(
    where: Record<string, unknown>,
    query: ListQueryDto,
  ): Promise<{
    items: CitizenIdea[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.ideas.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }
}
