import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  hours?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsBooleanString()
  emergency?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @IsOptional()
  @IsBooleanString()
  active?: string;
}

export class UpdatePlaceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  hours?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsBooleanString()
  emergency?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @IsOptional()
  @IsBooleanString()
  active?: string;
}

export class ListPlacesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsBooleanString()
  emergency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
