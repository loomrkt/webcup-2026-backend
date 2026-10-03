import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { TWO_FACTOR_SERVICE } from './auth.constants';
import { VERIFICATION_SERVICE } from './auth.constants';

import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { EmailCode } from './entities/email-code.entity';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  GithubEnabledGuard,
  GoogleEnabledGuard,
} from './guards/oauth-enabled.guard';

import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { OAuthController } from './oauth.controller';

import { TwoFactorController } from './two-factor.controller';

import { VerificationController } from './verification.controller';

import { AuthService } from './services/auth.service';
import { EmailCodeService } from './services/email-code.service';
import { MailService } from './services/mail.service';
import { OAuthService } from './services/oauth.service';

import { TokenService } from './services/token.service';
import { TotpService } from './services/totp.service';

import { TwoFactorService } from './services/two-factor.service';

import { VerificationService } from './services/verification.service';
import { AccountsModule } from '../accounts/accounts.module';
import { SecurityModule } from '../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      PasswordResetToken,
      OAuthAccount,
      EmailCode,
    ]),
    AccountsModule,
    SecurityModule,
    AuditModule,
  ],
  controllers: [
    AuthController,
    TwoFactorController,
    VerificationController,
    OAuthController,
  ],
  providers: [
    AuthService,
    MailService,
    TokenService,
    EmailCodeService,
    TwoFactorService,
    TotpService,
    { provide: TWO_FACTOR_SERVICE, useExisting: TwoFactorService },
    VerificationService,
    { provide: VERIFICATION_SERVICE, useExisting: VerificationService },
    OAuthService,
    GoogleStrategy,
    GithubStrategy,
    GoogleEnabledGuard,
    GithubEnabledGuard,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard, TokenService],
})
export class AuthModule {}
