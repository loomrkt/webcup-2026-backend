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
  CreateMobilityLineDto,
  CreateScheduleDto,
  ListMobilityLinesQueryDto,
  UpdateMobilityLineDto,
  UpdateScheduleDto,
} from './dto/mobility.dto';
import { MobilityLine } from './entities/mobility-line.entity';
import { MobilitySchedule } from './entities/mobility-schedule.entity';
import { MobilityService } from './mobility.service';

@Controller('mobility')
@UseGuards(PermissionsGuard)
export class MobilityController {
  constructor(private readonly mobility: MobilityService) {}

  @Get('lines')
  @Public()
  async list(
    @Query() query: ListMobilityLinesQueryDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(await this.mobility.list(query), 'Mobility lines fetched');
  }

  @Get('admin/lines')
  @RequirePermission('mobility.read')
  async listAll(): Promise<ApiSuccessResponse<unknown>> {
    return success(await this.mobility.listAll(), 'Mobility lines fetched');
  }

  @Post('lines')
  @RequirePermission('mobility.create')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateMobilityLineDto,
  ): Promise<ApiSuccessResponse<MobilityLine>> {
    return success(
      await this.mobility.create(currentUser.id, body),
      'Mobility line created',
      HttpStatus.CREATED,
    );
  }

  @Get('lines/:id')
  @Public()
  async get(
    @Param('id') id: string,
    @Query('day') day?: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(await this.mobility.get(id, day), 'Mobility line fetched');
  }

  @Patch('lines/:id')
  @RequirePermission('mobility.update')
  async update(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateMobilityLineDto,
  ): Promise<ApiSuccessResponse<MobilityLine>> {
    return success(
      await this.mobility.update(currentUser.id, id, body),
      'Mobility line updated',
    );
  }

  @Delete('lines/:id')
  @RequirePermission('mobility.delete')
  async remove(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.mobility.remove(currentUser.id, id);
    return success(null, 'Mobility line deleted');
  }

  @Post('lines/:id/schedules')
  @RequirePermission('mobility.create')
  async addSchedule(
    @Param('id') id: string,
    @Body() body: CreateScheduleDto,
  ): Promise<ApiSuccessResponse<MobilitySchedule>> {
    return success(
      await this.mobility.addSchedule(id, body),
      'Schedule added',
      HttpStatus.CREATED,
    );
  }

  @Patch('schedules/:scheduleId')
  @RequirePermission('mobility.update')
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() body: UpdateScheduleDto,
  ): Promise<ApiSuccessResponse<MobilitySchedule>> {
    return success(
      await this.mobility.updateSchedule(scheduleId, body),
      'Schedule updated',
    );
  }

  @Delete('schedules/:scheduleId')
  @RequirePermission('mobility.delete')
  async removeSchedule(
    @Param('scheduleId') scheduleId: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.mobility.removeSchedule(scheduleId);
    return success(null, 'Schedule deleted');
  }
}
