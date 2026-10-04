import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { paginated, success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import {
  CreateDataConcernDto,
  ListDataConcernsQueryDto,
  UpdateDataConcernDto,
} from './dto/participation.dto';
import { DataConcern } from './entities/data-concern.entity';
import {
  ParticipationService,
  type SupportStatus,
} from './participation.service';

@Controller('participation/concerns')
@UseGuards(PermissionsGuard)
export class ConcernsController {
  constructor(private readonly participation: ParticipationService) {}

  @Post()
  @RequirePermission('participation.concerns.create')
  async submit(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateDataConcernDto,
  ): Promise<ApiSuccessResponse<DataConcern>> {
    return success(
      await this.participation.submitConcern(currentUser.id, body),
      'Concern submitted. You will be able to follow its status from your citizen space.',
      HttpStatus.CREATED,
    );
  }

  @Get('me')
  @RequirePermission('participation.concerns.read')
  async myConcerns(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListDataConcernsQueryDto,
  ): Promise<ApiSuccessResponse<DataConcern[]>> {
    const result = await this.participation.myConcerns(currentUser.id, query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'My concerns fetched',
    );
  }

  @Get()
  @RequirePermission('participation.concerns.read')
  async list(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListDataConcernsQueryDto,
  ): Promise<ApiSuccessResponse<DataConcern[]>> {
    const result = await this.participation.listConcerns(currentUser.id, query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'Concerns fetched',
    );
  }

  @Get(':id')
  @RequirePermission('participation.concerns.read')
  async get(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<DataConcern>> {
    return success(
      await this.participation.getConcern(currentUser.id, id),
      'Concern fetched',
    );
  }

  @Patch(':id')
  @RequirePermission('participation.concerns.update')
  async update(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateDataConcernDto,
  ): Promise<ApiSuccessResponse<DataConcern>> {
    return success(
      await this.participation.updateConcern(currentUser.id, id, body),
      'Concern updated',
    );
  }
}

@Controller('requests')
@UseGuards(PermissionsGuard)
export class SupportsController {
  constructor(private readonly participation: ParticipationService) {}

  @Post(':id/support')
  @RequirePermission('requests.support')
  async support(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SupportStatus>> {
    return success(
      await this.participation.supportRequest(currentUser.id, id),
      'Request supported',
    );
  }

  @Delete(':id/support')
  @RequirePermission('requests.support')
  async withdraw(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SupportStatus>> {
    return success(
      await this.participation.withdrawSupport(currentUser.id, id),
      'Support withdrawn',
    );
  }

  @Get(':id/support')
  @RequirePermission('requests.read')
  async status(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SupportStatus>> {
    return success(
      await this.participation.supportStatus(currentUser.id, id),
      'Support status fetched',
    );
  }
}
