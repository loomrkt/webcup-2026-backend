import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthAccount } from '../entities/oauth-account.entity';
import { User } from '../entities/user.entity';
import { TokenService, TokenPair } from './token.service';

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(OAuthAccount)
    private readonly oauthAccounts: Repository<OAuthAccount>,
    private readonly config: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  private get requireEmailVerification(): boolean {
    return this.config.get<boolean>('AUTH_REQUIRE_EMAIL_VERIFICATION') ?? true;
  }

  async handleOAuthLogin(
    provider: string,
    profile: {
      providerId: string;
      email: string;
      displayName?: string;
    },
  ): Promise<TokenPair> {
    if (!profile.email) {
      throw new BadRequestException(`${provider} account has no email`);
    }
    const account = await this.oauthAccounts.findOne({
      where: { provider, providerId: profile.providerId },
      relations: { user: true },
    });
    if (account) {
      return this.tokenService.issueTokenPair(account.user);
    }
    let user = await this.users.findOne({
      where: { email: profile.email.toLowerCase().trim() },
    });
    if (!user) {
      const newUser = this.users.create({
        email: profile.email.toLowerCase().trim(),
      });
      if (!this.requireEmailVerification) {
        (newUser as unknown as { emailVerifiedAt: Date }).emailVerifiedAt =
          new Date();
      }
      user = await this.users.save(newUser);
    } else if (
      this.requireEmailVerification &&
      !(user as unknown as { emailVerifiedAt?: Date | null }).emailVerifiedAt
    ) {
      (user as unknown as { emailVerifiedAt: Date }).emailVerifiedAt =
        new Date();
      await this.users.save(user);
    }
    await this.oauthAccounts.save(
      this.oauthAccounts.create({
        provider,
        providerId: profile.providerId,
        userId: user.id,
      }),
    );
    return this.tokenService.issueTokenPair(user);
  }
}
