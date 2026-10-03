import {
  IsEmail,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class PasswordlessRequestDto {
  @IsEmail()
  email: string;
}

export class PasswordlessVerifyDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @IsNumberString()
  code: string;
}

export class RevokeAllSessionsDto {
  @IsOptional()
  @IsString()
  @Length(40, 200)
  refreshToken?: string;
}
