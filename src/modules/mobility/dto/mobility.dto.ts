import { Type } from 'class-transformer';
import {
  IsBoolean,
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
import { SCHEDULE_DAY_TYPES } from '../entities/mobility-schedule.entity';

export class CreateMobilityLineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: 'code must be alphanumeric (e.g. "L1")',
  })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  origin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  info?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  price?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  frequency?: string | null;

  @IsOptional()
  @IsBoolean()
  accessible?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateMobilityLineDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: 'code must be alphanumeric (e.g. "L1")',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  origin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  info?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  price?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  frequency?: string | null;

  @IsOptional()
  @IsBoolean()
  accessible?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListMobilityLinesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** 'today' = jour courant ; sinon weekday | saturday | sunday. */
  @IsOptional()
  @IsIn(['today', ...SCHEDULE_DAY_TYPES], {
    message: `day must be one of: today, ${SCHEDULE_DAY_TYPES.join(', ')}`,
  })
  day?: string;
}

export class CreateScheduleDto {
  @IsIn(SCHEDULE_DAY_TYPES, {
    message: `dayType must be one of: ${SCHEDULE_DAY_TYPES.join(', ')}`,
  })
  dayType: (typeof SCHEDULE_DAY_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string | null;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'departureTime must be HH:MM',
  })
  departureTime: string;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsIn(SCHEDULE_DAY_TYPES, {
    message: `dayType must be one of: ${SCHEDULE_DAY_TYPES.join(', ')}`,
  })
  dayType?: (typeof SCHEDULE_DAY_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'departureTime must be HH:MM',
  })
  departureTime?: string;
}

export class ListSchedulesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
