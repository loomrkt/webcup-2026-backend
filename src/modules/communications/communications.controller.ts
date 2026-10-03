import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { paginated, success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import type { AiAlertDraft } from './ai-alert.service';
import {
  AiGenerateAlertDto,
  CreateAlertDto,
  CreateAnnouncementDto,
  NotificationQueryDto,
  UpdateAlertDto,
  UpdateAnnouncementDto,
  UpdateNotificationPrefsDto,
  UpdateNotificationDto,
} from './dto/communications.dto';
import { Announcement } from './entities/announcement.entity';
import { Alert } from './entities/alert.entity';
import { Notification } from './entities/notification.entity';
import {
  CommunicationsService,
  type NotificationList,
} from './communications.service';

@Controller('announcements')
@UseGuards(PermissionsGuard)
export class AnnouncementsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get()
  @Public()
  async list(): Promise<ApiSuccessResponse<Announcement[]>> {
    return success(
      await this.communications.listPublicAnnouncements(),
      'Announcements fetched',
    );
  }

  @Get('admin')
  @RequirePermission('announcements.read')
  async listAll(): Promise<ApiSuccessResponse<Announcement[]>> {
    return success(
      await this.communications.listAllAnnouncements(),
      'Announcements fetched',
    );
  }

  @Post()
  @RequirePermission('announcements.create')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateAnnouncementDto,
  ): Promise<ApiSuccessResponse<Announcement>> {
    return success(
      await this.communications.createAnnouncement(currentUser.id, body),
      body.publish ? 'Announcement published' : 'Announcement saved as draft',
      HttpStatus.CREATED,
    );
  }

  @Get(':id')
  @Public()
  async get(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<Announcement>> {
    return success(
      await this.communications.getPublicAnnouncement(id),
      'Announcement fetched',
    );
  }

  @Patch(':id')
  @RequirePermission('announcements.update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAnnouncementDto,
  ): Promise<ApiSuccessResponse<Announcement>> {
    return success(
      await this.communications.updateAnnouncement(id, body),
      'Announcement updated',
    );
  }

  @Delete(':id')
  @RequirePermission('announcements.delete')
  async delete(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.communications.deleteAnnouncement(id);
    return success(null, 'Announcement deleted');
  }
}

@Controller('alerts')
@UseGuards(PermissionsGuard)
export class AlertsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('active')
  @Public()
  async active(
    @Query('zone') zone?: string,
  ): Promise<ApiSuccessResponse<Alert[]>> {
    return success(
      await this.communications.listActiveAlerts(zone),
      'Active alerts fetched',
    );
  }

  @Get('admin')
  @RequirePermission('alerts.read')
  async listAll(): Promise<ApiSuccessResponse<Alert[]>> {
    return success(await this.communications.listAllAlerts(), 'Alerts fetched');
  }

  @Post('ai/generate')
  @RequirePermission('alerts.create')
  async generate(
    @Body() body: AiGenerateAlertDto,
  ): Promise<ApiSuccessResponse<AiAlertDraft>> {
    return success(
      await this.communications.generateAlertDraft(body),
      'Alert draft generated',
    );
  }

  @Post()
  @RequirePermission('alerts.create')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateAlertDto,
  ): Promise<ApiSuccessResponse<Alert>> {
    return success(
      await this.communications.createAlert(currentUser.id, body),
      body.publish ? 'Alert published' : 'Alert saved as draft',
      HttpStatus.CREATED,
    );
  }

  @Post(':id/diffuse')
  @RequirePermission('alerts.update')
  async diffuse(@Param('id') id: string): Promise<ApiSuccessResponse<Alert>> {
    return success(
      await this.communications.diffuseAlert(id),
      'Alert diffused to inhabitants',
    );
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string): Promise<ApiSuccessResponse<Alert>> {
    const alert = await this.communications.getAlert(id);
    if (alert.status !== 'active') {
      throw new NotFoundException('Alert not found');
    }
    return success(alert, 'Alert fetched');
  }

  @Patch(':id')
  @RequirePermission('alerts.update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAlertDto,
  ): Promise<ApiSuccessResponse<Alert>> {
    return success(
      await this.communications.updateAlert(id, body),
      'Alert updated',
    );
  }

  @Delete(':id')
  @RequirePermission('alerts.delete')
  async delete(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.communications.deleteAlert(id);
    return success(null, 'Alert deleted');
  }
}

@Controller('notifications')
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get()
  @RequirePermission('notifications.read')
  async list(
    @CurrentUser() currentUser: { id: string },
    @Query() query: NotificationQueryDto,
  ): Promise<ApiSuccessResponse<Notification[]>> {
    const result: NotificationList = await this.communications.myNotifications(
      currentUser.id,
      query,
    );
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
        unreadCount: result.unreadCount,
      },
      'Notifications fetched',
    );
  }

  @Get('unread-count')
  @RequirePermission('notifications.read')
  async unreadCount(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<number>> {
    return success(
      await this.communications.unreadCount(currentUser.id),
      'Unread count fetched',
    );
  }

  @Get('preferences')
  @RequirePermission('notifications.read')
  async getPrefs(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<Record<string, boolean>>> {
    return success(
      await this.communications.getPrefs(currentUser.id),
      'Notification preferences fetched',
    );
  }

  @Patch('preferences')
  @RequirePermission('notifications.update')
  async updatePrefs(
    @CurrentUser() currentUser: { id: string },
    @Body() body: UpdateNotificationPrefsDto,
  ): Promise<ApiSuccessResponse<Record<string, boolean>>> {
    return success(
      await this.communications.updatePrefs(currentUser.id, body),
      'Notification preferences updated',
    );
  }

  @Patch('read-all')
  @RequirePermission('notifications.update')
  async readAll(
    @CurrentUser() currentUser: { id: string },
  ): Promise<ApiSuccessResponse<number>> {
    return success(
      await this.communications.markAllRead(currentUser.id),
      'All notifications marked as read',
    );
  }

  @Patch(':id')
  @RequirePermission('notifications.update')
  async markRead(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateNotificationDto,
  ): Promise<ApiSuccessResponse<Notification>> {
    return success(
      await this.communications.markRead(currentUser.id, id, body.read),
      body.read
        ? 'Notification marked as read'
        : 'Notification marked as unread',
    );
  }
}
