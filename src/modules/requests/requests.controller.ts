import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiSuccessResponse } from '../../common/api-response';
import { paginated, success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RateLimitGuard, Throttle } from '../../common/rate-limit.guard';
import {
  CreateRequestDto,
  ListRequestsQueryDto,
  UpdateRequestDto,
} from './dto/requests.dto';
import { RequestHistory } from './entities/request-history.entity';
import { Request } from './entities/request.entity';
import { RequestIndicators, RequestsService } from './requests.service';

const CSV_HEADERS = [
  'Référence',
  'Titre',
  'Description',
  'Catégorie',
  'Statut',
  'Priorité',
  'Service',
  'Localisation',
  'Créée le',
  'Mise à jour le',
  'Dernier événement',
  'Dernier commentaire',
];

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replaceAll('"', '""')}"`;
}

function toRequestsCsv(rows: Request[]): string {
  const lines = [CSV_HEADERS.map(csvCell).join(';')];
  for (const request of rows) {
    const sorted = [...(request.history ?? [])].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const latest = sorted[0];
    lines.push(
      [
        request.ref,
        request.title,
        request.description,
        request.category,
        request.status,
        request.priority,
        request.service?.name,
        request.location,
        request.createdAt.toISOString(),
        request.updatedAt.toISOString(),
        latest?.status ?? '',
        latest?.comment ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

@Controller('requests')
@UseGuards(PermissionsGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @Throttle({ limit: 20, windowSec: 900 })
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

  @Get('me/summary/download')
  @RequirePermission('requests.read')
  async summaryDownload(
    @CurrentUser() currentUser: { id: string },
    @Res() res: Response,
  ): Promise<string> {
    const rows = await this.requests.myRequestsSummary(currentUser.id);
    const csv = toRequestsCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mes-demandes.csv"',
    );
    return csv;
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

  @Get('export/download')
  @RequirePermission('requests.read')
  async exportDownload(@Res() res: Response): Promise<string> {
    const rows = await this.requests.allRequestsSummary();
    const csv = toRequestsCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="demandes-agents.csv"',
    );
    return csv;
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
