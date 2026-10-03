import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { paginated, success } from '../../common/api-response';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { ListSecurityEventsQueryDto } from './dto/security.dto';
import { SecurityEvent } from './entities/security-event.entity';
import { SecurityService, type SecurityEventList } from './security.service';

@Controller('security')
@UseGuards(PermissionsGuard)
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('events')
  @RequirePermission('security.read')
  async list(
    @Query() query: ListSecurityEventsQueryDto,
  ): Promise<ApiSuccessResponse<SecurityEvent[]>> {
    const result: SecurityEventList = await this.security.list(query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'Security events fetched',
    );
  }

  @Get('locks')
  @RequirePermission('security.read')
  async locks(): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.security.lockedAccounts(),
      'Locked accounts fetched',
    );
  }
}
