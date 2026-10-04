import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { APPOINTMENT_STATUSES } from '../entities/appointment.entity';
import { SLOT_STATUSES } from '../entities/appointment-slot.entity';

export class CreateSlotsDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:MM',
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be HH:MM',
  })
  endTime: string;

  @IsInt()
  @Min(10)
  @Max(120)
  slotDurationMinutes: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @IsOptional()
  @IsUUID()
  agentId?: string | null;
}

export class ListSlotsQueryDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}

export class BookAppointmentDto {
  @IsUUID()
  slotId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  reminderMinutes?: number;
}

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES, {
    message: `status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  citizenId?: string;

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

export class UpdateAppointmentDto {
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES, {
    message: `status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateSlotDto {
  @IsOptional()
  @IsIn(SLOT_STATUSES, {
    message: `status must be one of: ${SLOT_STATUSES.join(', ')}`,
  })
  status?: string;
}
