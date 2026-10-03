import { Controller, Get, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
@UseGuards(PermissionsGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('export')
  @RequirePermission('privacy.export')
  async export(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.privacy.exportData(currentUser.id),
      'Personal data export generated',
    );
  }
}
