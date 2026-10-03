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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { CreatePublicationDto, UpdatePublicationDto } from './dto/news.dto';
import { Publication } from './entities/publication.entity';
import { NewsService } from './news.service';

@Controller('news')
@UseGuards(PermissionsGuard)
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @Public()
  async list(): Promise<ApiSuccessResponse<Publication[]>> {
    return success(await this.news.listPublic(), 'Publications fetched');
  }

  @Get('admin/all')
  @RequirePermission('news.read')
  async listAll(): Promise<ApiSuccessResponse<Publication[]>> {
    return success(await this.news.listAll(), 'Publications fetched');
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string): Promise<ApiSuccessResponse<Publication>> {
    return success(await this.news.getPublic(id), 'Publication fetched');
  }

  @Post()
  @RequirePermission('news.create')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreatePublicationDto,
  ): Promise<ApiSuccessResponse<Publication>> {
    return success(
      await this.news.create(currentUser.id, body),
      'Publication created',
    );
  }

  @Patch(':id')
  @RequirePermission('news.update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePublicationDto,
  ): Promise<ApiSuccessResponse<Publication>> {
    return success(await this.news.update(id, body), 'Publication updated');
  }

  @Delete(':id')
  @RequirePermission('news.delete')
  async delete(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.news.delete(id);
    return success(null, 'Publication deleted');
  }
}
