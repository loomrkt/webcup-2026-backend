import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { RateLimitGuard, Throttle } from '../../common/rate-limit.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/misc.dto';
import {
  PasswordlessRequestDto,
  PasswordlessVerifyDto,
  RevokeAllSessionsDto,
} from './dto/passwordless.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/profile.dto';
import { UpdateOnboardingDto, UpdatePreferencesDto } from './dto/profile.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService, LoginResult } from './services/auth.service';
import { DeleteOwnAccountDto } from '../accounts/dto/accounts.dto';
import { AccountsService } from '../accounts/accounts.service';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountsService: AccountsService,
  ) {}

  @Post('register')
  @Throttle({ limit: 10, windowSec: 900 })
  async register(
    @Body() body: RegisterDto,
  ): Promise<ApiSuccessResponse<{ id: string; email: string }>> {
    const user = await this.authService.register(body.email, body.password);
    return success(
      { id: user.id, email: user.email },
      'Registration successful. Check your email to verify your account.',
    );
  }

  @Post('login')
  @Throttle({ limit: 20, windowSec: 900 })
  async login(
    @Req() req: Request,
    @Body() body: LoginDto,
  ): Promise<ApiSuccessResponse<LoginResult>> {
    const result = await this.authService.login(body.email, body.password, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return success(result, 'Login successful');
  }

  @Post('refresh')
  @Throttle({ limit: 60, windowSec: 900 })
  async refresh(
    @Req() req: Request,
    @Body() body: RefreshTokenDto,
  ): Promise<
    ApiSuccessResponse<{ accessToken: string; refreshToken: string }>
  > {
    const result = await this.authService.refresh(body.refreshToken, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return success(result, 'Tokens refreshed');
  }

  @Post('passwordless/request')
  @Throttle({ limit: 10, windowSec: 900 })
  async passwordlessRequest(
    @Req() req: Request,
    @Body() body: PasswordlessRequestDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.passwordlessRequest(body.email, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return success(
      null,
      'If that email exists, a one-time sign-in code has been sent',
    );
  }

  @Post('passwordless/verify')
  @Throttle({ limit: 10, windowSec: 900 })
  async passwordlessVerify(
    @Req() req: Request,
    @Body() body: PasswordlessVerifyDto,
  ): Promise<ApiSuccessResponse<LoginResult>> {
    const result = await this.authService.passwordlessVerify(
      body.email,
      body.code,
      {
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      },
    );
    return success(result, 'Sign-in code verified');
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @Throttle({ limit: 60, windowSec: 900 })
  async sessions(
    @CurrentUser() currentUser: { id: string },
    @Body() body?: RefreshTokenDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.authService.sessions(currentUser.id, body?.refreshToken),
      'Sessions fetched',
    );
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @Throttle({ limit: 20, windowSec: 900 })
  async revokeAllSessions(
    @CurrentUser() currentUser: { id: string },
    @Body() body: RevokeAllSessionsDto,
  ): Promise<ApiSuccessResponse<{ revoked: number }>> {
    return success(
      await this.authService.revokeAllSessions(
        currentUser.id,
        body.refreshToken,
      ),
      'All other sessions revoked',
    );
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ limit: 30, windowSec: 900 })
  async revokeSession(
    @Req() req: Request,
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<{ id: string; revoked: boolean }>> {
    return success(
      await this.authService.revokeSession(currentUser.id, id, {
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      }),
      'Session revoked',
    );
  }

  @Post('logout')
  @Throttle({ limit: 60, windowSec: 900 })
  async logout(
    @Body() body: RefreshTokenDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.logout(body.refreshToken);
    return success(null, 'Logged out');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    const user = await this.authService.getProfileWithRoles(currentUser.id);
    if (!user) {
      return success(null, 'Profile fetched');
    }
    return success(user, 'Profile fetched');
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() currentUser: { id: string },
    @Body() body: UpdateProfileDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const user = await this.authService.updateProfile(currentUser.id, body);
    return success(
      {
        id: user?.id,
        email: user?.email,
        profile: {
          firstName: user?.firstName,
          lastName: user?.lastName,
          phone: user?.phone,
          address: user?.address,
          city: user?.city,
        },
      },
      'Profile updated',
    );
  }

  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @CurrentUser() currentUser: { id: string },
    @Body() body: UpdatePreferencesDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const user = await this.authService.updatePreferences(currentUser.id, body);
    return success(
      {
        language: user?.language ?? 'fr',
        preferences: user?.preferences ?? {},
      },
      'Preferences updated',
    );
  }

  @Get('me/onboarding')
  @UseGuards(JwtAuthGuard)
  async getOnboarding(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.authService.getOnboarding(currentUser.id),
      'Onboarding state fetched',
    );
  }

  @Patch('me/onboarding')
  @UseGuards(JwtAuthGuard)
  async updateOnboarding(
    @CurrentUser() currentUser: { id: string },
    @Body() body: UpdateOnboardingDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.authService.updateOnboarding(currentUser.id, body),
      'Onboarding state updated',
    );
  }

  @Get('me/profile-completion')
  @UseGuards(JwtAuthGuard)
  async profileCompletion(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.authService.profileCompletion(currentUser.id),
      'Profile completion fetched',
    );
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteOwnAccount(
    @CurrentUser() currentUser: { id: string },
    @Body() body: DeleteOwnAccountDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.accountsService.deleteOwnAccount(currentUser.id, body);
    return success(null, 'Account deleted');
  }

  @Post('forgot-password')
  @Throttle({ limit: 10, windowSec: 900 })
  async forgotPassword(
    @Req() req: Request,
    @Body() body: ForgotPasswordDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.forgotPassword(body.email, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return success(null, 'If that email exists, a reset link has been sent');
  }

  @Post('reset-password')
  @Throttle({ limit: 10, windowSec: 900 })
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.resetPassword(body.token, body.password);
    return success(null, 'Password reset successfully');
  }
}
