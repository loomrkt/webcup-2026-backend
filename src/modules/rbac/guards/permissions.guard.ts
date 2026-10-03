import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { RbacService } from '../rbac.service';

@Injectable()
export class PermissionsGuard extends JwtAuthGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id?: string } }>();
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException('Authentication required');

    if (await this.rbacService.isSuperAdmin(userId)) return true;

    const permissions = await this.rbacService.effectivePermissions(userId);
    const missing = required.filter((p) => !permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
