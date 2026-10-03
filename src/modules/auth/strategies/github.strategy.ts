import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GitHubStrategy } from 'passport-github2';

type GitHubProfile = {
  id: number;
  login?: string;
  displayName?: string;
  email?: string;
};

@Injectable()
export class GithubStrategy extends PassportStrategy(GitHubStrategy, 'github') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID:
        config.get<string>('GITHUB_CLIENT_ID')?.trim() || 'unconfigured',
      clientSecret:
        config.get<string>('GITHUB_CLIENT_SECRET')?.trim() || 'unconfigured',
      callbackURL:
        config.get<string>('GITHUB_CALLBACK_URL') ??
        'http://localhost:5000/api/auth/github/callback',
      scope: ['read:user', 'user:email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GitHubProfile,
  ) {
    return {
      provider: 'github',
      providerId: String(profile.id),
      email: profile.email ?? profile.login ?? '',
      displayName: profile.displayName ?? profile.login ?? '',
    };
  }
}
