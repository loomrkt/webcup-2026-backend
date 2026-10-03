import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9 ().-]*$/, {
    message: 'phone contains invalid characters',
  })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;
}
