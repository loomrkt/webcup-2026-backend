import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CreateGuideStepDto, UpdateGuideStepDto } from './dto/guides.dto';
import { GuideStep } from './entities/guide-step.entity';

export interface GuideProgress {
  completed: string[];
  dismissed: string[];
}

@Injectable()
export class GuidesService {
  constructor(
    @InjectRepository(GuideStep)
    private readonly steps: Repository<GuideStep>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async listActive(): Promise<GuideStep[]> {
    return this.steps.find({
      where: { active: true },
      order: { order: 'ASC' },
    });
  }

  async listAll(): Promise<GuideStep[]> {
    return this.steps.find({ order: { order: 'ASC' } });
  }

  async create(dto: CreateGuideStepDto): Promise<GuideStep> {
    return this.steps.save(
      this.steps.create({
        key: dto.key.trim(),
        title: dto.title.trim(),
        description: dto.description,
        target: dto.target ?? null,
        order: dto.order ?? 0,
        dismissible: dto.dismissible ?? true,
        active: dto.active ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateGuideStepDto): Promise<GuideStep> {
    const step = await this.steps.findOne({ where: { id } });
    if (!step) throw new NotFoundException('Guide step not found');
    if (dto.title !== undefined) step.title = dto.title.trim();
    if (dto.description !== undefined) step.description = dto.description;
    if (dto.target !== undefined) step.target = dto.target ?? null;
    if (dto.order !== undefined) step.order = dto.order;
    if (dto.dismissible !== undefined) step.dismissible = dto.dismissible;
    if (dto.active !== undefined) step.active = dto.active;
    return this.steps.save(step);
  }

  async remove(id: string): Promise<void> {
    const step = await this.steps.findOne({ where: { id } });
    if (!step) throw new NotFoundException('Guide step not found');
    await this.steps.delete({ id });
  }

  private progressOf(user: User): GuideProgress {
    const onboarding = user.onboarding ?? {};
    return {
      completed: Array.isArray(onboarding.guideCompleted)
        ? (onboarding.guideCompleted as string[])
        : [],
      dismissed: Array.isArray(onboarding.guideDismissed)
        ? (onboarding.guideDismissed as string[])
        : [],
    };
  }

  /** Étapes actives + état de progression de l'utilisateur (F35). */
  async forUser(userId: string): Promise<{
    steps: Array<GuideStep & { completed: boolean; dismissed: boolean }>;
    progress: { completed: number; total: number };
  }> {
    const [steps, user] = await Promise.all([
      this.listActive(),
      this.users.findOne({ where: { id: userId } }),
    ]);
    const progress = user
      ? this.progressOf(user)
      : { completed: [], dismissed: [] };
    return {
      steps: steps.map((step) => ({
        ...step,
        completed: progress.completed.includes(step.key),
        dismissed: progress.dismissed.includes(step.key),
      })),
      progress: {
        completed: steps.filter((s) => progress.completed.includes(s.key))
          .length,
        total: steps.length,
      },
    };
  }

  private async updateProgress(
    userId: string,
    mutate: (progress: GuideProgress) => void,
  ): Promise<GuideProgress> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const progress = this.progressOf(user);
    mutate(progress);
    user.onboarding = {
      ...(user.onboarding ?? {}),
      guideCompleted: progress.completed,
      guideDismissed: progress.dismissed,
    };
    await this.users.save(user);
    return progress;
  }

  async complete(userId: string, key: string): Promise<GuideProgress> {
    return this.updateProgress(userId, (p) => {
      if (!p.completed.includes(key)) p.completed.push(key);
      p.dismissed = p.dismissed.filter((k) => k !== key);
    });
  }

  async dismiss(userId: string, key: string): Promise<GuideProgress> {
    return this.updateProgress(userId, (p) => {
      if (!p.dismissed.includes(key)) p.dismissed.push(key);
      p.completed = p.completed.filter((k) => k !== key);
    });
  }

  async reset(userId: string): Promise<GuideProgress> {
    return this.updateProgress(userId, (p) => {
      p.completed = [];
      p.dismissed = [];
    });
  }
}
