import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { RateLimitGuard, Throttle } from '../../common/rate-limit.guard';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verification.dto';
import { VerificationService } from './services/verification.service';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('verify-email')
  @Throttle({ limit: 20, windowSec: 900 })
  async verifyEmail(
    @Body() body: VerifyEmailDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.verificationService.verifyEmail(body.token);
    return success(null, 'Email verified successfully');
  }

  @Post('resend-verification')
  @Throttle({ limit: 10, windowSec: 900 })
  async resendVerification(
    @Body() body: ResendVerificationDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.verificationService.resendVerification(body.email);
    return success(null, 'Verification email resent');
  }
}
