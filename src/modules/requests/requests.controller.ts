import {
  Body,
  Controller,
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
  CreateRequestDto,
  ListRequestsQueryDto,
  UpdateRequestDto,
} from './dto/requests.dto';
import { RequestHistory } from './entities/request-history.entity';
import { Request } from './entities/request.entity';
import { RequestIndicators, RequestsService } from './requests.service';

@Controller('requests')
@UseGuards(PermissionsGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @RequirePermission('requests.create')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateRequestDto,
  ): Promise<ApiSuccessResponse<Request>> {
    const request = await this.requests.create(currentUser.id, body);
    return success(
      request,
      `Request submitted — reference ${request.ref}`,
      HttpStatus.CREATED,
    );
  }

  @Get()
  @RequirePermission('requests.read')
  async list(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListRequestsQueryDto,
  ): Promise<ApiSuccessResponse<Request[]>> {
    const result = await this.requests.list(currentUser.id, query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'Requests fetched',
    );
  }

  @Get('me')
  @RequirePermission('requests.read')
  async myRequests(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListRequestsQueryDto,
  ): Promise<ApiSuccessResponse<Request[]>> {
    const result = await this.requests.myRequests(currentUser.id, query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'My requests fetched',
    );
  }

  @Get('me/history')
  @RequirePermission('requests.read')
  async myHistory(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListRequestsQueryDto,
  ): Promise<ApiSuccessResponse<RequestHistory[]>> {
    const result = await this.requests.myHistory(currentUser.id, query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'My request history fetched',
    );
  }

  @Get('indicators')
  @RequirePermission('requests.read')
  async indicators(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<RequestIndicators>> {
    return success(
      await this.requests.indicators(currentUser.id),
      'Request indicators fetched',
    );
  }

  @Get(':id')
  @RequirePermission('requests.read')
  async get(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<Request>> {
    return success(
      await this.requests.get(currentUser.id, id),
      'Request fetched',
    );
  }

  @Patch(':id')
  @RequirePermission('requests.update')
  async update(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateRequestDto,
  ): Promise<ApiSuccessResponse<Request>> {
    return success(
      await this.requests.update(currentUser.id, id, body),
      'Request updated',
    );
  }
}
