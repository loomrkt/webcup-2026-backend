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
import { success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import {
  CreatePlaceDto,
  ListPlacesQueryDto,
  UpdatePlaceDto,
} from './dto/places.dto';
import { Place } from './entities/place.entity';
import { PlacesService } from './places.service';

@Controller('places')
@UseGuards(PermissionsGuard)
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  @Public()
  async list(
    @Query() query: ListPlacesQueryDto,
  ): Promise<ApiSuccessResponse<Place[]>> {
    return success(await this.places.list(query), 'Places fetched');
  }

  @Get('emergency')
  @Public()
  async emergency(): Promise<ApiSuccessResponse<Place[]>> {
    return success(
      await this.places.list({ emergency: 'true' }),
      'Emergency services fetched',
    );
  }

  @Get('admin')
  @RequirePermission('places.manage')
  async listAll(): Promise<ApiSuccessResponse<Place[]>> {
    return success(await this.places.listAll(), 'Places fetched');
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string): Promise<ApiSuccessResponse<Place>> {
    return success(await this.places.get(id), 'Place fetched');
  }

  @Post()
  @RequirePermission('places.manage')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreatePlaceDto,
  ): Promise<ApiSuccessResponse<Place>> {
    return success(
      await this.places.create(currentUser.id, body),
      'Place created',
      HttpStatus.CREATED,
    );
  }

  @Patch(':id')
  @RequirePermission('places.manage')
  async update(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdatePlaceDto,
  ): Promise<ApiSuccessResponse<Place>> {
    return success(
      await this.places.update(currentUser.id, id, body),
      'Place updated',
    );
  }

  @Delete(':id')
  @RequirePermission('places.manage')
  async remove(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.places.remove(currentUser.id, id);
    return success(null, 'Place deleted');
  }
}
