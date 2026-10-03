import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { RateLimitGuard, Throttle } from '../../common/rate-limit.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  TotpActivateDto,
  TotpDeactivateDto,
  VerifyTwoFactorDto,
} from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginResult, TwoFactorService } from './services/two-factor.service';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('2fa/verify')
  @Throttle({ limit: 10, windowSec: 900 })
  async verifyTwoFactor(
    @Body() body: VerifyTwoFactorDto,
  ): Promise<ApiSuccessResponse<LoginResult>> {
    const result = await this.twoFactorService.verifyTwoFactor(
      body.pendingToken,
      body.code,
    );
    return success(result, 'Two-factor verified');
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @Throttle({ limit: 20, windowSec: 900 })
  async setup(
    @CurrentUser() currentUser: { id: string; email: string },
  ): Promise<ApiSuccessResponse<{ secret: string; qrDataUrl: string }>> {
    const result = await this.twoFactorService.setup(
      currentUser.id,
      currentUser.email,
    );
    return success(result, '2FA setup initiated. Scan the QR code.');
  }

  @Post('2fa/activate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ limit: 20, windowSec: 900 })
  async activate(
    @CurrentUser() currentUser: { id: string },
    @Body() body: TotpActivateDto,
  ): Promise<ApiSuccessResponse<{ recoveryCodes: string[] }>> {
    const result = await this.twoFactorService.activate(
      currentUser.id,
      body.code,
    );
    return success(result, '2FA activated. Save your recovery codes.');
  }

  @Post('2fa/deactivate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ limit: 20, windowSec: 900 })
  async deactivate(
    @CurrentUser() currentUser: { id: string },
    @Body() body: TotpDeactivateDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.twoFactorService.deactivate(currentUser.id, body.code);
    return success(null, '2FA deactivated');
  }
}
