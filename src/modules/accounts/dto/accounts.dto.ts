import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Suppression du compte par le citoyen lui-même (F33). */
export class DeleteOwnAccountDto {
  /** Mot de passe exigé si le compte en possède un ; sinon l'email. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  /** Confirmation explicite de l'action (obligatoire). */
  @IsBoolean()
  confirm: boolean;
}

export class ListAccountsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn([...ACCOUNT_STATUSES, 'deleted'], {
    message: `status must be one of: ${[...ACCOUNT_STATUSES, 'deleted'].join(', ')}`,
  })
  status?: string;

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

export class UpdateAccountDto {
  @IsOptional()
  @IsIn(ACCOUNT_STATUSES, {
    message: `status must be one of: ${ACCOUNT_STATUSES.join(', ')}`,
  })
  status?: AccountStatus;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName?: string | null;
}

export class DeleteAccountDto {
  /** `true` = suppression physique (cascade) ; défaut = anonymisation + désactivation. */
  @IsOptional()
  @IsBoolean()
  permanent?: boolean;
}
