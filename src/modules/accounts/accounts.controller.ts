import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { paginated, success } from '../../common/api-response';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import {
  DeleteAccountDto,
  ListAccountsQueryDto,
  UpdateAccountDto,
} from './dto/accounts.dto';
import { User } from '../auth/entities/user.entity';
import { AccountsService, type AccountList } from './accounts.service';

@Controller('accounts')
@UseGuards(PermissionsGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermission('accounts.read')
  async list(
    @Query() query: ListAccountsQueryDto,
  ): Promise<ApiSuccessResponse<User[]>> {
    const result: AccountList = await this.accounts.list(query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'Accounts fetched',
    );
  }

  @Get(':id')
  @RequirePermission('accounts.read')
  async get(@Param('id') id: string): Promise<ApiSuccessResponse<User>> {
    return success(await this.accounts.get(id), 'Account fetched');
  }

  @Patch(':id')
  @RequirePermission('accounts.update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAccountDto,
  ): Promise<ApiSuccessResponse<User>> {
    return success(await this.accounts.update(id, body), 'Account updated');
  }

  @Delete(':id')
  @RequirePermission('accounts.delete')
  async delete(
    @Param('id') id: string,
    @Body() body: DeleteAccountDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.accounts.delete(id, body ?? {});
    return success(null, 'Account deleted');
  }

  @Post(':id/restore')
  @RequirePermission('accounts.update')
  async restore(@Param('id') id: string): Promise<ApiSuccessResponse<User>> {
    return success(await this.accounts.restore(id), 'Account restored');
  }
}
