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
import { paginated, success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import {
  AppointmentsService,
  type AppointmentList,
} from './appointments.service';
import {
  BookAppointmentDto,
  CreateSlotsDto,
  ListAppointmentsQueryDto,
  ListSlotsQueryDto,
  UpdateAppointmentDto,
  UpdateSlotDto,
} from './dto/appointments.dto';
import { Appointment } from './entities/appointment.entity';
import { AppointmentSlot } from './entities/appointment-slot.entity';

@Controller('appointments')
@UseGuards(PermissionsGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  // ── Créneaux ──
  @Get('slots')
  @RequirePermission('appointments.read')
  async listSlots(
    @Query() query: ListSlotsQueryDto,
  ): Promise<ApiSuccessResponse<AppointmentSlot[]>> {
    return success(
      await this.appointments.listSlots(query),
      'Available slots fetched',
    );
  }

  @Post('slots')
  @RequirePermission('appointments.manage')
  async createSlots(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateSlotsDto,
  ): Promise<ApiSuccessResponse<AppointmentSlot[]>> {
    return success(
      await this.appointments.createSlots(currentUser.id, body),
      'Slots created',
      HttpStatus.CREATED,
    );
  }

  @Patch('slots/:id')
  @RequirePermission('appointments.manage')
  async updateSlot(
    @Param('id') id: string,
    @Body() body: UpdateSlotDto,
  ): Promise<ApiSuccessResponse<AppointmentSlot>> {
    return success(
      await this.appointments.updateSlot(id, body),
      'Slot updated',
    );
  }

  // ── Rendez-vous ──
  @Post()
  @RequirePermission('appointments.create')
  async book(
    @CurrentUser() currentUser: { id: string },
    @Body() body: BookAppointmentDto,
  ): Promise<ApiSuccessResponse<Appointment>> {
    const appointment = await this.appointments.book(currentUser.id, body);
    return success(
      appointment,
      `Appointment confirmed — reference ${appointment.ref}`,
      HttpStatus.CREATED,
    );
  }

  @Get('me')
  @RequirePermission('appointments.read')
  async mine(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<Appointment[]>> {
    return success(
      await this.appointments.myAppointments(currentUser.id),
      'My appointments fetched',
    );
  }

  @Get()
  @RequirePermission('appointments.manage')
  async list(
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<ApiSuccessResponse<Appointment[]>> {
    const result: AppointmentList = await this.appointments.list(query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'Appointments fetched',
    );
  }

  @Get(':id')
  @RequirePermission('appointments.read')
  async get(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<Appointment>> {
    return success(
      await this.appointments.get(currentUser.id, id),
      'Appointment fetched',
    );
  }

  @Post(':id/cancel')
  @RequirePermission('appointments.read')
  async cancel(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<Appointment>> {
    return success(
      await this.appointments.cancel(currentUser.id, id),
      'Appointment cancelled',
    );
  }

  @Patch(':id')
  @RequirePermission('appointments.manage')
  async update(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateAppointmentDto,
  ): Promise<ApiSuccessResponse<Appointment>> {
    return success(
      await this.appointments.update(currentUser.id, id, body),
      'Appointment updated',
    );
  }
}
