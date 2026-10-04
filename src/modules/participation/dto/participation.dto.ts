import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DATA_CONCERN_STATUSES,
  type DataConcernStatus,
} from '../entities/data-concern.entity';

export class CreateDataConcernDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string | null;

  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  message: string;
}

export class UpdateDataConcernDto {
  @IsOptional()
  @IsIn(DATA_CONCERN_STATUSES, {
    message: `status must be one of: ${DATA_CONCERN_STATUSES.join(', ')}`,
  })
  status?: DataConcernStatus;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  response?: string | null;
}

export class ListDataConcernsQueryDto {
  @IsOptional()
  @IsIn(DATA_CONCERN_STATUSES, {
    message: `status must be one of: ${DATA_CONCERN_STATUSES.join(', ')}`,
  })
  status?: DataConcernStatus;

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
}
