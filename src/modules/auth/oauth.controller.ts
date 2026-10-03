import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard, Throttle } from '../../common/rate-limit.guard';
import {
  GithubEnabledGuard,
  GoogleEnabledGuard,
} from './guards/oauth-enabled.guard';
import { OAuthService } from './services/oauth.service';

interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string;
  displayName: string;
}

@Controller('auth')
@UseGuards(RateLimitGuard)
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  @Throttle({ limit: 20, windowSec: 900 })
  google() {}

  @Get('google/callback')
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  @Throttle({ limit: 20, windowSec: 900 })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.oauthService.handleOAuthLogin(
      'google',
      req.user as OAuthProfile,
    );
    this.redirectWithTokens(res, result);
  }

  @Get('github')
  @UseGuards(GithubEnabledGuard, AuthGuard('github'))
  @Throttle({ limit: 20, windowSec: 900 })
  github() {}

  @Get('github/callback')
  @UseGuards(GithubEnabledGuard, AuthGuard('github'))
  @Throttle({ limit: 20, windowSec: 900 })
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.oauthService.handleOAuthLogin(
      'github',
      req.user as OAuthProfile,
    );
    this.redirectWithTokens(res, result);
  }

  private redirectWithTokens(
    res: Response,
    result: { accessToken: string; refreshToken: string },
  ) {
    const url =
      (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000') +
      '/oauth-success' +
      `?accessToken=${result.accessToken}` +
      `&refreshToken=${result.refreshToken}`;
    res.redirect(url);
  }
}
