import { Global, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RBAC_SERVICE } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/entities/user.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { Organization } from './entities/organization.entity';
import { TENANT_SERVICE } from './rbac.constants';
import { HierarchyController } from './hierarchy.controller';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Permission,
      Role,
      UserRole,
      User,
      Organization,
    ]),
    AuthModule,
  ],
  controllers: [RbacController, HierarchyController, TenantController],
  providers: [
    RbacService,
    TenantService,
    { provide: TENANT_SERVICE, useExisting: TenantService },
    PermissionsGuard,
    { provide: RBAC_SERVICE, useExisting: RbacService },
  ],
  exports: [RbacService, PermissionsGuard, RBAC_SERVICE],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  async onModuleInit(): Promise<void> {
    await this.rbacService.seedIfNeeded();
  }
}
