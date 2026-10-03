import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
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
import { CreateGuideStepDto, UpdateGuideStepDto } from './dto/guides.dto';
import { GuideStep } from './entities/guide-step.entity';
import { GuideProgress, GuidesService } from './guides.service';

@Controller('guides')
@UseGuards(PermissionsGuard)
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  @Public()
  async list(): Promise<ApiSuccessResponse<GuideStep[]>> {
    return success(await this.guides.listActive(), 'Guide steps fetched');
  }

  @Get('admin')
  @RequirePermission('guides.manage')
  async listAll(): Promise<ApiSuccessResponse<GuideStep[]>> {
    return success(await this.guides.listAll(), 'Guide steps fetched');
  }

  @Get('me')
  @RequirePermission('guides.read')
  async forUser(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.guides.forUser(currentUser.id),
      'Guide progress fetched',
    );
  }

  @Post(':key/complete')
  @RequirePermission('guides.read')
  async complete(
    @CurrentUser() currentUser: { id: string },
    @Param('key') key: string,
  ): Promise<ApiSuccessResponse<GuideProgress>> {
    return success(
      await this.guides.complete(currentUser.id, key),
      'Guide step completed',
    );
  }

  @Post(':key/dismiss')
  @RequirePermission('guides.read')
  async dismiss(
    @CurrentUser() currentUser: { id: string },
    @Param('key') key: string,
  ): Promise<ApiSuccessResponse<GuideProgress>> {
    return success(
      await this.guides.dismiss(currentUser.id, key),
      'Guide step dismissed',
    );
  }

  @Post('me/reset')
  @RequirePermission('guides.read')
  async reset(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<GuideProgress>> {
    return success(
      await this.guides.reset(currentUser.id),
      'Guide progress reset',
    );
  }

  @Post()
  @RequirePermission('guides.manage')
  async create(
    @Body() body: CreateGuideStepDto,
  ): Promise<ApiSuccessResponse<GuideStep>> {
    return success(
      await this.guides.create(body),
      'Guide step created',
      HttpStatus.CREATED,
    );
  }

  @Patch(':id')
  @RequirePermission('guides.manage')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateGuideStepDto,
  ): Promise<ApiSuccessResponse<GuideStep>> {
    return success(await this.guides.update(id, body), 'Guide step updated');
  }

  @Delete(':id')
  @RequirePermission('guides.manage')
  async remove(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.guides.remove(id);
    return success(null, 'Guide step deleted');
  }
}
