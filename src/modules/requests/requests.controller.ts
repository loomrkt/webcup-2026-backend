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
import { success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import {
  CreateRequestDto,
  ListRequestsQueryDto,
  UpdateRequestDto,
} from './dto/requests.dto';
import { Request } from './entities/request.entity';
import { RequestsService } from './requests.service';

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
    return success(
      await this.requests.create(currentUser.id, body),
      'Request submitted',
      HttpStatus.CREATED,
    );
  }

  @Get()
  @RequirePermission('requests.read')
  async list(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListRequestsQueryDto,
  ): Promise<ApiSuccessResponse<Request[]>> {
    return success(
      await this.requests.list(currentUser.id, query),
      'Requests fetched',
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
