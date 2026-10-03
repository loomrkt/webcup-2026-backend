import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GoogleOAuth20Strategy } from 'passport-google-oauth20';

type GoogleProfile = {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
};

export const isGoogleConfigured = (config: ConfigService): boolean =>
  !!config.get<string>('GOOGLE_CLIENT_ID')?.trim() &&
  !!config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GoogleOAuth20Strategy,
  'google',
) {
  constructor(private readonly config: ConfigService) {
    super({
      clientID:
        config.get<string>('GOOGLE_CLIENT_ID')?.trim() || 'unconfigured',
      clientSecret:
        config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || 'unconfigured',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:5000/api/auth/google/callback',
      scope: ['profile', 'email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
  ) {
    return {
      provider: 'google',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.displayName ?? '',
    };
  }
}
