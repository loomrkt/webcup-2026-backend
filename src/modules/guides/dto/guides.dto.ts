import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGuideStepDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[a-z0-9.-]+$/, {
    message:
      'key must be lowercase alphanumeric with dots/hyphens (e.g. "services.first-request")',
  })
  key: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  target?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  dismissible?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateGuideStepDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  target?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  dismissible?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
