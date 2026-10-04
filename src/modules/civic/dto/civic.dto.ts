import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PROJECT_STATUSES,
  type ProjectStatus,
} from '../entities/city-project.entity';
import {
  CONSULTATION_STATUSES,
  type ConsultationStatus,
} from '../entities/consultation.entity';
import {
  FEEDBACK_SENTIMENTS,
  type FeedbackSentiment,
} from '../entities/project-feedback.entity';
import {
  IDEA_STATUSES,
  type IdeaStatus,
} from '../entities/citizen-idea.entity';

// ─── F67 : projets ──────────────────────────────────────────────────────────

export class CreateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsOptional()
  @IsIn(PROJECT_STATUSES, {
    message: `status must be one of: ${PROJECT_STATUSES.join(', ')}`,
  })
  status?: ProjectStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  responsible?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  nextSteps?: string | null;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsOptional()
  @IsIn(PROJECT_STATUSES, {
    message: `status must be one of: ${PROJECT_STATUSES.join(', ')}`,
  })
  status?: ProjectStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  responsible?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  nextSteps?: string | null;
}

// ─── F66 : avis sur un projet ───────────────────────────────────────────────

export class SubmitFeedbackDto {
  @IsOptional()
  @IsIn(FEEDBACK_SENTIMENTS, {
    message: `sentiment must be one of: ${FEEDBACK_SENTIMENTS.join(', ')}`,
  })
  sentiment?: FeedbackSentiment | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string | null;
}

// ─── F65 : consultations ────────────────────────────────────────────────────

export class CreateConsultationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  question: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsArray()
  @ArrayMinSize(2, { message: 'At least two choices are required' })
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  choices: string[];

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsOptional()
  @IsBoolean()
  resultsPublic?: boolean;

  @IsOptional()
  @IsIn(CONSULTATION_STATUSES, {
    message: `status must be one of: ${CONSULTATION_STATUSES.join(', ')}`,
  })
  status?: ConsultationStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class UpdateConsultationDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'At least two choices are required' })
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  choices?: string[];

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsOptional()
  @IsBoolean()
  resultsPublic?: boolean;

  @IsOptional()
  @IsIn(CONSULTATION_STATUSES, {
    message: `status must be one of: ${CONSULTATION_STATUSES.join(', ')}`,
  })
  status?: ConsultationStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class RespondConsultationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  choice: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string | null;
}

// ─── F68 : idées ────────────────────────────────────────────────────────────

export class CreateIdeaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;
}

export class UpdateIdeaDto {
  @IsOptional()
  @IsIn(IDEA_STATUSES, {
    message: `status must be one of: ${IDEA_STATUSES.join(', ')}`,
  })
  status?: IdeaStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNote?: string | null;
}

// ─── Pagination partagée ────────────────────────────────────────────────────

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}
