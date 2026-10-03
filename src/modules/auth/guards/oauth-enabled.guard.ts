import {
  CanActivate,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
abstract class OAuthEnabledGuard implements CanActivate {
  constructor(
    protected readonly config: ConfigService,
    private readonly provider: 'google' | 'github',
  ) {}

  canActivate(): boolean {
    const enabled =
      this.provider === 'google'
        ? !!this.config.get<string>('GOOGLE_CLIENT_ID') &&
          !!this.config.get<string>('GOOGLE_CLIENT_SECRET')
        : !!this.config.get<string>('GITHUB_CLIENT_ID') &&
          !!this.config.get<string>('GITHUB_CLIENT_SECRET');
    if (!enabled) {
      throw new NotImplementedException(
        `OAuth ${this.provider} is not configured (missing credentials in .env)`,
      );
    }
    return true;
  }
}

@Injectable()
export class GoogleEnabledGuard extends OAuthEnabledGuard {
  constructor(config: ConfigService) {
    super(config, 'google');
  }
}

@Injectable()
export class GithubEnabledGuard extends OAuthEnabledGuard {
  constructor(config: ConfigService) {
    super(config, 'github');
  }
}
