import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import {
  CreatePermissionDto,
  CreateRoleDto,
  UpdatePermissionDto,
  UpdateRoleDto,
} from './dto/rbac.dto';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';

@Controller('rbac')
@UseGuards(PermissionsGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('permissions')
  @RequirePermission('rbac.permissions.read')
  async listPermissions(): Promise<ApiSuccessResponse<Permission[]>> {
    const permissions = await this.rbacService.listPermissions();
    return success(permissions, 'Permissions fetched');
  }

  @Post('permissions')
  @RequirePermission('rbac.permissions.create')
  async createPermission(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreatePermissionDto,
  ): Promise<ApiSuccessResponse<Permission>> {
    const permission = await this.rbacService.createPermission(
      currentUser.id,
      body,
    );
    return success(permission, 'Permission created');
  }

  @Patch('permissions/:id')
  @RequirePermission('rbac.permissions.update')
  async updatePermission(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdatePermissionDto,
  ): Promise<ApiSuccessResponse<Permission>> {
    const permission = await this.rbacService.updatePermission(
      currentUser.id,
      id,
      body,
    );
    return success(permission, 'Permission updated');
  }

  @Delete('permissions/:id')
  @RequirePermission('rbac.permissions.delete')
  async deletePermission(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.rbacService.deletePermission(currentUser.id, id);
    return success(null, 'Permission deleted');
  }

  @Get('roles')
  @RequirePermission('rbac.roles.read')
  async listRoles(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<Role[]>> {
    const roles = await this.rbacService.listRoles(currentUser.id);
    return success(roles, 'Roles fetched');
  }

  @Get('roles/:id')
  @RequirePermission('rbac.roles.read')
  async getRole(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<Role>> {
    const role = await this.rbacService.getRole(currentUser.id, id);
    return success(role, 'Role fetched');
  }

  @Post('roles')
  @RequirePermission('rbac.roles.create')
  async createRole(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateRoleDto,
  ): Promise<ApiSuccessResponse<Role>> {
    const role = await this.rbacService.createRole(currentUser.id, body);
    return success(role, 'Role created');
  }

  @Patch('roles/:id')
  @RequirePermission('rbac.roles.update')
  async updateRole(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
  ): Promise<ApiSuccessResponse<Role>> {
    const role = await this.rbacService.updateRole(currentUser.id, id, body);
    return success(role, 'Role updated');
  }

  @Delete('roles/:id')
  @RequirePermission('rbac.roles.delete')
  async deleteRole(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.rbacService.deleteRole(currentUser.id, id);
    return success(null, 'Role deleted');
  }

  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  async myPermissions(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<string[]>> {
    const permissions = await this.rbacService.effectivePermissions(
      currentUser.id,
    );
    return success(permissions, 'Your permissions fetched');
  }
}
