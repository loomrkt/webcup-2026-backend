import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CONTACT_STATUSES,
  type ContactStatus,
} from '../entities/contact-message.entity';

export class CreateContactMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  message: string;
}

export class UpdateContactMessageDto {
  @IsOptional()
  @IsIn(CONTACT_STATUSES, {
    message: `status must be one of: ${CONTACT_STATUSES.join(', ')}`,
  })
  status?: ContactStatus;
}
