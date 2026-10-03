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
import { Public } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import {
  CreateGlossaryTermDto,
  ListGlossaryQueryDto,
  UpdateGlossaryTermDto,
} from './dto/glossary.dto';
import { GlossaryTerm } from './entities/glossary-term.entity';
import { GlossaryService } from './glossary.service';

@Controller('glossary')
@UseGuards(PermissionsGuard)
export class GlossaryController {
  constructor(private readonly glossary: GlossaryService) {}

  @Get()
  @Public()
  async list(
    @Query() query: ListGlossaryQueryDto,
  ): Promise<ApiSuccessResponse<GlossaryTerm[]>> {
    return success(await this.glossary.listPublic(query), 'Glossary fetched');
  }

  @Get('admin')
  @RequirePermission('glossary.manage')
  async listAll(): Promise<ApiSuccessResponse<GlossaryTerm[]>> {
    return success(await this.glossary.listAll(), 'Glossary fetched');
  }

  @Post()
  @RequirePermission('glossary.manage')
  async create(
    @Body() body: CreateGlossaryTermDto,
  ): Promise<ApiSuccessResponse<GlossaryTerm>> {
    return success(
      await this.glossary.create(body),
      'Glossary term created',
      HttpStatus.CREATED,
    );
  }

  @Patch(':id')
  @RequirePermission('glossary.manage')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateGlossaryTermDto,
  ): Promise<ApiSuccessResponse<GlossaryTerm>> {
    return success(
      await this.glossary.update(id, body),
      'Glossary term updated',
    );
  }

  @Delete(':id')
  @RequirePermission('glossary.manage')
  async remove(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.glossary.remove(id);
    return success(null, 'Glossary term deleted');
  }
}
