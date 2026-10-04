import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { paginated, success } from '../../common/api-response';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { AuditService, type AuditList } from './audit.service';
import { ListAuditQueryDto } from './dto/audit.dto';
import { AuditEvent } from './entities/audit-event.entity';

@Controller('audit')
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  async list(
    @Query() query: ListAuditQueryDto,
  ): Promise<ApiSuccessResponse<AuditEvent[]>> {
    const result: AuditList = await this.audit.list(query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'Audit events fetched',
    );
  }

  @Get('entity-types')
  @RequirePermission('audit.read')
  async entityTypes(): Promise<ApiSuccessResponse<string[]>> {
    return success(
      await this.audit.distinctEntityTypes(),
      'Audit entity types fetched',
    );
  }
}
