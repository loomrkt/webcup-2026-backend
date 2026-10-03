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
import { success } from '../../common/api-response';
import { Public } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { CreateServiceDto, UpdateServiceDto } from './dto/services.dto';
import { Service } from './entities/service.entity';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(PermissionsGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @Public()
  async list(
    @Query('locale') locale?: string,
  ): Promise<ApiSuccessResponse<Service[]>> {
    return success(await this.services.listPublic(locale), 'Services fetched');
  }

  @Get('featured')
  @Public()
  async featured(
    @Query('locale') locale?: string,
  ): Promise<ApiSuccessResponse<Service[]>> {
    return success(
      await this.services.listFeatured(locale),
      'Featured services fetched',
    );
  }

  @Get('popular')
  @Public()
  async popular(
    @Query('limit') limit?: string,
    @Query('locale') locale?: string,
  ): Promise<ApiSuccessResponse<Service[]>> {
    const parsed = limit ? Number(limit) : 10;
    const safe = Number.isInteger(parsed) ? parsed : 10;
    return success(
      await this.services.listPopular(safe, locale),
      'Popular services fetched',
    );
  }

  @Get('search')
  @Public()
  async search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('locale') locale?: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const parsed = limit ? Number(limit) : 10;
    const safe = Number.isInteger(parsed) ? parsed : 10;
    return success(
      await this.services.search(q?.trim() ?? '', safe, locale),
      'Services searched',
    );
  }

  @Get('admin/all')
  @RequirePermission('services.read')
  async listAll(): Promise<ApiSuccessResponse<Service[]>> {
    return success(await this.services.listAll(), 'Services fetched');
  }

  @Get(':id')
  @Public()
  async get(
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ): Promise<ApiSuccessResponse<Service>> {
    return success(
      await this.services.getPublic(id, locale),
      'Service fetched',
    );
  }

  @Post()
  @RequirePermission('services.create')
  async create(
    @Body() body: CreateServiceDto,
  ): Promise<ApiSuccessResponse<Service>> {
    return success(await this.services.create(body), 'Service created');
  }

  @Patch(':id')
  @RequirePermission('services.update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateServiceDto,
  ): Promise<ApiSuccessResponse<Service>> {
    return success(await this.services.update(id, body), 'Service updated');
  }

  @Delete(':id')
  @RequirePermission('services.delete')
  async delete(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.services.delete(id);
    return success(null, 'Service deleted');
  }
}
