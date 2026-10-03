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
  CreateTranslationDto,
  ListTranslationsQueryDto,
  UpdateTranslationDto,
} from './dto/i18n.dto';
import { Translation } from './entities/translation.entity';
import { I18nService } from './i18n.service';

@Controller('i18n')
@UseGuards(PermissionsGuard)
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Get('translations')
  @Public()
  async getMap(
    @Query('locale') locale?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ): Promise<ApiSuccessResponse<Record<string, string>>> {
    return success(
      await this.i18n.getMap(entityType ?? '', entityId ?? null, locale),
      'Translations fetched',
    );
  }

  @Get('ui/:locale')
  @Public()
  async getUiStrings(
    @Param('locale') locale: string,
  ): Promise<ApiSuccessResponse<Record<string, string>>> {
    return success(
      await this.i18n.getMap('ui', null, locale),
      'UI strings fetched',
    );
  }

  @Get('admin')
  @RequirePermission('i18n.read')
  async listAll(
    @Query() query: ListTranslationsQueryDto,
  ): Promise<ApiSuccessResponse<Translation[]>> {
    return success(await this.i18n.listAll(query), 'Translations fetched');
  }

  @Post()
  @RequirePermission('i18n.manage')
  async upsert(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateTranslationDto,
  ): Promise<ApiSuccessResponse<Translation>> {
    return success(
      await this.i18n.upsert(currentUser.id, body),
      'Translation saved',
      HttpStatus.CREATED,
    );
  }

  @Patch(':id')
  @RequirePermission('i18n.manage')
  async update(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateTranslationDto,
  ): Promise<ApiSuccessResponse<Translation>> {
    return success(
      await this.i18n.update(currentUser.id, id, body),
      'Translation updated',
    );
  }

  @Delete(':id')
  @RequirePermission('i18n.manage')
  async remove(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.i18n.remove(currentUser.id, id);
    return success(null, 'Translation deleted');
  }
}
