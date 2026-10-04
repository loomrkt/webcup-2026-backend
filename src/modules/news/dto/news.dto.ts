import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePublicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @IsString()
  @MinLength(10)
  @MaxLength(100_000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdatePublicationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(100_000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
