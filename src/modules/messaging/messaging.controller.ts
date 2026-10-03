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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import {
  CreateConversationDto,
  CreateMessageDto,
  ListMessagesQueryDto,
} from './dto/messaging.dto';
// @purge:groups-start
import {
  AddMemberDto,
  RemoveMemberDto,
  UpdateMemberDto,
} from './dto/messaging.dto';
// @purge:groups-end
// @purge:e2ee-start
import { PublishKeyDto } from './dto/messaging.dto';
// @purge:e2ee-end
// @purge:presence-start
import { UpdatePresenceDto } from './dto/messaging.dto';
// @purge:presence-end
// @purge:edit-delete-start
import { EditMessageDto } from './dto/messaging.dto';
// @purge:edit-delete-end
// @purge:block-start
import { BlockUserDto } from './dto/messaging.dto';
// @purge:block-end
// @purge:realtime-start
import { MessagingGateway } from './messaging.gateway';
// @purge:realtime-end
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    // @purge:realtime-start
    private readonly gateway: MessagingGateway,
    // @purge:realtime-end
  ) {}

  // @purge:e2ee-start
  @Post('keys')
  async publishKey(
    @CurrentUser() user: { id: string },
    @Body() body: PublishKeyDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.publishKey(user.id, body),
      'E2EE key published',
      HttpStatus.CREATED,
    );
  }

  @Get('keys/me')
  async myKey(
    @CurrentUser() user: { id: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.getMyKey(user.id),
      'Your E2EE key fetched',
    );
  }

  @Get('keys/:userId')
  async userKey(
    @Param('userId') userId: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(await this.messaging.getUserKey(userId), 'E2EE key fetched');
  }
  // @purge:e2ee-end

  // @purge:presence-start
  @Patch('presence')
  async updatePresence(
    @CurrentUser() user: { id: string },
    @Body() body: UpdatePresenceDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const presence = await this.messaging.updatePresence(user.id, body.status);
    // @purge:realtime-start
    this.gateway.notifyPresence(presence);
    // @purge:realtime-end
    return success(presence, 'Presence updated');
  }

  @Get('presence')
  async listPresence(): Promise<ApiSuccessResponse<unknown[]>> {
    return success(await this.messaging.listPresence(), 'Presence fetched');
  }

  @Get('presence/:userId')
  async getPresence(
    @Param('userId') userId: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.getPresence(userId),
      'Presence fetched',
    );
  }
  // @purge:presence-end

  // @purge:receipts-start
  @Post('messages/:id/read')
  async markMessageRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const receipt = await this.messaging.markMessageRead(user.id, id);
    // @purge:realtime-start
    const conversationId = await this.messaging.getMessageConversationId(id);
    this.gateway.notifyReceipt(conversationId, receipt);
    // @purge:realtime-end
    return success(receipt, 'Marked as read', HttpStatus.CREATED);
  }

  @Get('messages/:id/receipts')
  async messageReceipts(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    return success(
      await this.messaging.listMessageReceipts(user.id, id),
      'Receipts fetched',
    );
  }
  // @purge:receipts-end

  @Post('conversations')
  async createConversation(
    @CurrentUser() user: { id: string },
    @Body() body: CreateConversationDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    // @purge:groups-start
    if (body.type === 'group' || body.memberIds) {
      const { conversation } = await this.messaging.createGroupConversation(
        user.id,
        body,
      );
      return success(conversation, 'Group created', HttpStatus.CREATED);
    }
    // @purge:groups-end
    const { conversation, created } =
      await this.messaging.createDirectConversation(user.id, body.memberId);
    return success(
      conversation,
      created ? 'Conversation created' : 'Conversation already exists',
      created ? HttpStatus.CREATED : HttpStatus.OK,
    );
  }

  // @purge:groups-start
  @Post('conversations/:id/members')
  async addMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: AddMemberDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.addGroupMember(user.id, id, body),
      'Member added',
      HttpStatus.CREATED,
    );
  }

  @Patch('conversations/:id/members/:userId')
  async updateMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() body: UpdateMemberDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.updateGroupMember(user.id, id, targetUserId, body),
      'Member updated',
    );
  }

  @Delete('conversations/:id/members/:userId')
  async removeMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() body: RemoveMemberDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.removeGroupMember(user.id, id, targetUserId, body),
      'Member removed',
    );
  }
  // @purge:groups-end

  @Get('conversations')
  async listConversations(
    @CurrentUser() user: { id: string },
  ): Promise<ApiSuccessResponse<unknown[]>> {
    return success(
      await this.messaging.listMyConversations(user.id),
      'Conversations fetched',
    );
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.getConversation(user.id, id),
      'Conversation fetched',
    );
  }

  @Post('conversations/:id/leave')
  async leaveConversation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.messaging.leaveConversation(user.id, id);
    return success(null, 'Left conversation');
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    return success(
      await this.messaging.listMessages(user.id, id, query),
      'Messages fetched',
    );
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: CreateMessageDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const saved = await this.messaging.sendMessage(user.id, id, body);
    // @purge:realtime-start
    this.gateway.notifyNewMessage(id, saved);
    // @purge:realtime-end
    return success(saved, 'Message sent', HttpStatus.CREATED);
  }

  // @purge:replies-start
  @Get('messages/:id/replies')
  async messageReplies(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    return success(
      await this.messaging.listMessageReplies(user.id, id),
      'Replies fetched',
    );
  }
  // @purge:replies-end

  // @purge:edit-delete-start
  @Patch('messages/:id')
  async editMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: EditMessageDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const edited = await this.messaging.editMessage(user.id, id, body.content);
    // @purge:realtime-start
    const conversationId = await this.messaging.getMessageConversationId(id);
    this.gateway.notifyMessageEdited(conversationId, edited);
    // @purge:realtime-end
    return success(edited, 'Message edited');
  }

  @Delete('messages/:id')
  async deleteMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const deleted = await this.messaging.deleteMessage(user.id, id);
    // @purge:realtime-start
    const conversationId = await this.messaging.getMessageConversationId(id);
    this.gateway.notifyMessageDeleted(conversationId, id);
    // @purge:realtime-end
    return success(deleted, 'Message deleted');
  }
  // @purge:edit-delete-end

  // @purge:block-start
  @Post('blocks')
  async blockUser(
    @CurrentUser() user: { id: string },
    @Body() body: BlockUserDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.messaging.blockUser(user.id, body.userId),
      'User blocked',
      HttpStatus.CREATED,
    );
  }

  @Get('blocks')
  async listBlocks(
    @CurrentUser() user: { id: string },
  ): Promise<ApiSuccessResponse<unknown[]>> {
    return success(await this.messaging.listBlocks(user.id), 'Blocks fetched');
  }

  @Delete('blocks/:userId')
  async unblockUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.messaging.unblockUser(user.id, userId);
    return success(null, 'User unblocked');
  }
  // @purge:block-end

  @Get('admin/conversations')
  @UseGuards(PermissionsGuard)
  @RequirePermission('messaging.admin.read')
  async adminConversations(): Promise<ApiSuccessResponse<unknown[]>> {
    return success(
      await this.messaging.listAllConversations(),
      'All conversations',
    );
  }
}
