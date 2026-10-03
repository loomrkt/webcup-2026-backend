import { Controller, Get, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  @RequirePermission('dashboard.read')
  async stats(): Promise<ApiSuccessResponse<unknown>> {
    return success(await this.dashboard.stats(), 'Dashboard stats fetched');
  }

  @Get('nova-terra')
  @RequirePermission('nova-terra.read')
  async novaTerra(): Promise<ApiSuccessResponse<unknown>> {
    return success(await this.dashboard.novaTerra(), 'Nova Terra data fetched');
  }
}
