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
  async list(): Promise<ApiSuccessResponse<Service[]>> {
    return success(await this.services.listPublic(), 'Services fetched');
  }

  @Get('admin/all')
  @RequirePermission('services.read')
  async listAll(): Promise<ApiSuccessResponse<Service[]>> {
    return success(await this.services.listAll(), 'Services fetched');
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string): Promise<ApiSuccessResponse<Service>> {
    return success(await this.services.getPublic(id), 'Service fetched');
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
