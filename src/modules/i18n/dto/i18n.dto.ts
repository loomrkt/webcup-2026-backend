import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTranslationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  entityType: string;

  @IsOptional()
  @IsUUID()
  entityId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  field: string;

  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'locale must be like "fr", "en" or "pt-BR"',
  })
  locale: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  value: string;
}

export class UpdateTranslationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  value?: string;
}

export class ListTranslationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'locale must be like "fr", "en" or "pt-BR"',
  })
  locale?: string;
}
