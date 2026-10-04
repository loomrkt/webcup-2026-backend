import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

export const TEXT_SIZES = ['normal', 'large', 'xlarge'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const LINE_SPACINGS = ['normal', 'relaxed', 'wide'] as const;
export type LineSpacing = (typeof LINE_SPACINGS)[number];

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'language must be a locale like "fr", "en" or "pt-BR"',
  })
  language?: string;

  @IsOptional()
  @IsIn(TEXT_SIZES, {
    message: `textSize must be one of: ${TEXT_SIZES.join(', ')}`,
  })
  textSize?: TextSize;

  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  readableFont?: boolean;

  @IsOptional()
  @IsIn(LINE_SPACINGS, {
    message: `lineSpacing must be one of: ${LINE_SPACINGS.join(', ')}`,
  })
  lineSpacing?: LineSpacing;

  @IsOptional()
  @IsIn(['default', 'high-contrast', 'dark'], {
    message: 'colorScheme must be one of: default, high-contrast, dark',
  })
  colorScheme?: string;

  @IsOptional()
  @IsIn(['none', 'protanopia', 'deuteranopia', 'tritanopia'], {
    message:
      'colorBlind must be one of: none, protanopia, deuteranopia, tritanopia',
  })
  colorBlind?: string;

  @IsOptional()
  @IsBoolean()
  plainLanguage?: boolean;
}

export class UpdateOnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: 'not_started' | 'in_progress' | 'completed';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedSteps?: string[];
}
