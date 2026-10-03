import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  type RequestPriority,
  type RequestStatus,
} from '../entities/request.entity';

export class CreateRequestDto {
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

  @IsOptional()
  @IsIn(REQUEST_PRIORITIES, {
    message: `priority must be one of: ${REQUEST_PRIORITIES.join(', ')}`,
  })
  priority?: RequestPriority;
}

export class UpdateRequestDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES, {
    message: `status must be one of: ${REQUEST_STATUSES.join(', ')}`,
  })
  status?: RequestStatus;

  @IsOptional()
  @IsIn(REQUEST_PRIORITIES, {
    message: `priority must be one of: ${REQUEST_PRIORITIES.join(', ')}`,
  })
  priority?: RequestPriority;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  adminNote?: string | null;
}

export class ListRequestsQueryDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES, {
    message: `status must be one of: ${REQUEST_STATUSES.join(', ')}`,
  })
  status?: RequestStatus;

  @IsOptional()
  @IsIn(REQUEST_PRIORITIES, {
    message: `priority must be one of: ${REQUEST_PRIORITIES.join(', ')}`,
  })
  priority?: RequestPriority;
}
