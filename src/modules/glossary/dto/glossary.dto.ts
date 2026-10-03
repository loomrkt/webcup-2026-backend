import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGlossaryTermDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  term: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  definition: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateGlossaryTermDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  term?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  definition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListGlossaryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
