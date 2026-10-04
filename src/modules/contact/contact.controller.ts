import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { success } from '../../common/api-response';
import { RateLimitGuard, Throttle } from '../../common/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { ContactService } from './contact.service';
import {
  CreateContactMessageDto,
  UpdateContactMessageDto,
} from './dto/contact.dto';
import { ContactMessage } from './entities/contact-message.entity';

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @Public()
  @UseGuards(RateLimitGuard)
  @Throttle({ limit: 5, windowSec: 900 })
  async create(
    @Body() body: CreateContactMessageDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const { reference } = await this.contact.create(body);
    return success(
      { reference },
      `Message received. Reference: ${reference}`,
      HttpStatus.CREATED,
    );
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('contact.read')
  async list(): Promise<ApiSuccessResponse<ContactMessage[]>> {
    return success(await this.contact.listAll(), 'Messages fetched');
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('contact.update')
  async updateStatus(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateContactMessageDto,
  ): Promise<ApiSuccessResponse<ContactMessage>> {
    return success(
      await this.contact.updateStatus(currentUser.id, id, body),
      'Message updated',
    );
  }
}
