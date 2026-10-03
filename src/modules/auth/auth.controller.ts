import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { RateLimitGuard, Throttle } from '../../common/rate-limit.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/misc.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/profile.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService, LoginResult } from './services/auth.service';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
    @Body() body: LoginDto,
  ): Promise<ApiSuccessResponse<LoginResult>> {
    const result = await this.authService.login(body.email, body.password);
    return success(result, 'Login successful');
  }

  @Post('refresh')
  @Throttle({ limit: 60, windowSec: 900 })
  async refresh(
    @Body() body: RefreshTokenDto,
  ): Promise<
    ApiSuccessResponse<{ accessToken: string; refreshToken: string }>
  > {
    const result = await this.authService.refresh(body.refreshToken);
    return success(result, 'Tokens refreshed');
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

  @Post('forgot-password')
  @Throttle({ limit: 10, windowSec: 900 })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.forgotPassword(body.email);
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
