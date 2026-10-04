import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SERVICE_STATUSES } from '../entities/service.entity';

/** F63 — activation/désactivation rapide d'un service par un administrateur. */
export class SetServiceAvailabilityDto {
  @IsBoolean()
  available: boolean;

  /** Statut à appliquer (par défaut : incident si désactivé, available si activé). */
  @IsOptional()
  @IsIn(SERVICE_STATUSES, {
    message: `status must be one of: ${SERVICE_STATUSES.join(', ')}`,
  })
  status?: (typeof SERVICE_STATUSES)[number];

  /** Motif de l'indisponibilité, visible par les habitants. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

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
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  featuredOrder?: number;

  @IsOptional()
  @IsIn(SERVICE_STATUSES, {
    message: `status must be one of: ${SERVICE_STATUSES.join(', ')}`,
  })
  status?: (typeof SERVICE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  statusMessage?: string | null;

  @IsOptional()
  @IsDateString()
  resumeAt?: string | null;

  @IsOptional()
  @IsUUID()
  alternativeServiceId?: string | null;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

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
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  featuredOrder?: number;

  @IsOptional()
  @IsIn(SERVICE_STATUSES, {
    message: `status must be one of: ${SERVICE_STATUSES.join(', ')}`,
  })
  status?: (typeof SERVICE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  statusMessage?: string | null;

  @IsOptional()
  @IsDateString()
  resumeAt?: string | null;

  @IsOptional()
  @IsUUID()
  alternativeServiceId?: string | null;
}
