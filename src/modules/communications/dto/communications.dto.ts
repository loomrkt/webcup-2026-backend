import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsBooleanString,
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
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
} from '../entities/announcement.entity';
import { ALERT_CRITICALITIES, ALERT_STATUSES } from '../entities/alert.entity';
import { NOTIFICATION_TYPES } from '../entities/notification.entity';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  content: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES, {
    message: `priority must be one of: ${ANNOUNCEMENT_PRIORITIES.join(', ')}`,
  })
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaUrl?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  content?: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES, {
    message: `priority must be one of: ${ANNOUNCEMENT_PRIORITIES.join(', ')}`,
  })
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES, {
    message: `status must be one of: ${ANNOUNCEMENT_STATUSES.join(', ')}`,
  })
  status?: (typeof ANNOUNCEMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaUrl?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class CreateAlertDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  message: string;

  @IsOptional()
  @IsIn(ALERT_CRITICALITIES, {
    message: `criticality must be one of: ${ALERT_CRITICALITIES.join(', ')}`,
  })
  criticality?: (typeof ALERT_CRITICALITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  recommendations?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  vulnerableRecommendations?: string[] | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  message?: string;

  @IsOptional()
  @IsIn(ALERT_CRITICALITIES, {
    message: `criticality must be one of: ${ALERT_CRITICALITIES.join(', ')}`,
  })
  criticality?: (typeof ALERT_CRITICALITIES)[number];

  @IsOptional()
  @IsIn(ALERT_STATUSES, {
    message: `status must be one of: ${ALERT_STATUSES.join(', ')}`,
  })
  status?: (typeof ALERT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  recommendations?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  vulnerableRecommendations?: string[] | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class AiGenerateAlertDto {
  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  situation: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'language must be like "fr", "en" or "pt-BR"',
  })
  language?: string;
}

export class NotificationQueryDto {
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
  @IsIn(NOTIFICATION_TYPES, {
    message: `type must be one of: ${NOTIFICATION_TYPES.join(', ')}`,
  })
  type?: (typeof NOTIFICATION_TYPES)[number];

  @IsOptional()
  @IsBooleanString()
  read?: string;
}

export class UpdateNotificationDto {
  @IsBoolean()
  read: boolean;
}

export class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  announcement?: boolean;

  @IsOptional()
  @IsBoolean()
  alert?: boolean;

  @IsOptional()
  @IsBoolean()
  system?: boolean;
}
