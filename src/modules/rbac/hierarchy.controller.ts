import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from './decorators/require-permission.decorator';
import { AssignRoleDto, CreateChildUserDto } from './dto/rbac.dto';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';

@Controller('rbac')
@UseGuards(PermissionsGuard)
export class HierarchyController {
  constructor(private readonly rbacService: RbacService) {}

  @Post('users')
  @RequirePermission('rbac.users.create')
  async createChildUser(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateChildUserDto,
  ): Promise<ApiSuccessResponse<{ id: string; email: string }>> {
    const user = await this.rbacService.createChildUser(currentUser.id, body);
    return success(
      { id: user.id, email: user.email },
      'Child user created and roles assigned',
    );
  }

  @Get('users')
  @RequirePermission('rbac.users.read')
  async listVisibleUsers(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const users = await this.rbacService.listVisibleUsers(currentUser.id);
    return success(users, 'Users fetched');
  }

  @Post('users/:id/roles')
  @RequirePermission('rbac.users.assign')
  async assignRole(
    @CurrentUser() currentUser: { id: string },
    @Param('id') targetUserId: string,
    @Body() body: AssignRoleDto,
  ): Promise<ApiSuccessResponse<UserRole>> {
    const assignment = await this.rbacService.assignRoleToUser(
      currentUser.id,
      targetUserId,
      body,
    );
    return success(assignment, 'Role assigned');
  }

  @Get('tree')
  @RequirePermission('rbac.roles.read')
  async tree(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<{ roles: Role[]; users: unknown[] }>> {
    const [roles, users] = await Promise.all([
      this.rbacService.listRoles(currentUser.id),
      this.rbacService.listDescendantUsers(currentUser.id),
    ]);
    return success({ roles, users }, 'RBAC tree fetched');
  }
}
