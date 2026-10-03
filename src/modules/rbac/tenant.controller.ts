import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from './decorators/require-permission.decorator';
import {
  CreateOrganizationDto,
  SetUserOrgDto,
  UpdateOrganizationDto,
} from './dto/rbac.dto';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';
import { TenantService } from './tenant.service';

@Controller('rbac')
@UseGuards(PermissionsGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly rbacService: RbacService,
  ) {}

  private async assertSuperAdmin(userId: string): Promise<void> {
    if (!(await this.rbacService.isSuperAdmin(userId))) {
      throw new ForbiddenException('Superadmin required');
    }
  }

  @Get('organizations')
  @RequirePermission('rbac.organizations.read')
  async listOrganizations(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const orgs = await this.tenantService.listVisibleOrganizations(
      currentUser.id,
    );
    return success(orgs, 'Organizations fetched');
  }

  @Post('organizations')
  @RequirePermission('rbac.organizations.create')
  async createOrganization(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateOrganizationDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.assertSuperAdmin(currentUser.id);
    const org = await this.tenantService.createOrganization(body);
    return success(org, 'Organization created');
  }

  @Patch('organizations/:id')
  @RequirePermission('rbac.organizations.update')
  async updateOrganization(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateOrganizationDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.assertSuperAdmin(currentUser.id);
    const org = await this.tenantService.updateOrganization(id, body);
    return success(org, 'Organization updated');
  }

  @Delete('organizations/:id')
  @RequirePermission('rbac.organizations.delete')
  async deleteOrganization(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.assertSuperAdmin(currentUser.id);
    await this.tenantService.deleteOrganization(id);
    return success(null, 'Organization deleted');
  }

  @Patch('users/:id/org')
  @RequirePermission('rbac.organizations.assign')
  async setUserOrg(
    @CurrentUser() currentUser: { id: string },
    @Param('id') targetUserId: string,
    @Body() body: SetUserOrgDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.assertSuperAdmin(currentUser.id);
    const user = await this.tenantService.setUserOrg(targetUserId, body);
    return success(
      { id: user.id, email: user.email, organizationId: user.organizationId },
      'User organization updated',
    );
  }
}
