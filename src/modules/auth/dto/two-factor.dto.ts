import { IsNumberString, IsString, Length } from 'class-validator';

export class TotpActivateDto {
  @IsString()
  @Length(6, 6)
  @IsNumberString()
  code: string;
}

export class TotpDeactivateDto {
  @IsString()
  code: string;
}

export class VerifyTwoFactorDto {
  @IsString()
  code: string;

  @IsString()
  pendingToken: string;
}
