import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
// @purge:e2ee-start
import { IsNull } from 'typeorm';
// @purge:e2ee-end
// @purge:receipts-start
import { MoreThan, Not } from 'typeorm';
// @purge:receipts-end
// @purge:groups-start
import { In } from 'typeorm';
// @purge:groups-end
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CreateMessageDto } from './dto/messaging.dto';
// @purge:groups-start
import {
  AddMemberDto,
  CreateConversationDto,
  RemoveMemberDto,
  UpdateMemberDto,
} from './dto/messaging.dto';
// @purge:groups-end
// @purge:e2ee-start
import { PublishKeyDto } from './dto/messaging.dto';
// @purge:e2ee-end
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message } from './entities/message.entity';
import { ConversationMemberKey } from './entities/conversation-member-key.entity'; // @purge:groups-import
import { Presence, PresenceStatus } from './entities/presence.entity'; // @purge:presence-import
import { MessageReceipt } from './entities/message-receipt.entity'; // @purge:receipts-import
import { BlockedUser } from './entities/blocked-user.entity'; // @purge:block-import
import { UserKey } from './entities/user-key.entity'; // @purge:e2ee-import

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly members: Repository<ConversationMember>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    // @purge:e2ee-start
    @InjectRepository(UserKey)
    private readonly userKeys: Repository<UserKey>,
    // @purge:e2ee-end
    // @purge:presence-start
    @InjectRepository(Presence)
    private readonly presence: Repository<Presence>,
    // @purge:presence-end
    // @purge:receipts-start
    @InjectRepository(MessageReceipt)
    private readonly receipts: Repository<MessageReceipt>,
    // @purge:receipts-end
    // @purge:groups-start
    @InjectRepository(ConversationMemberKey)
    private readonly memberKeys: Repository<ConversationMemberKey>,
    // @purge:groups-end
    // @purge:block-start
    @InjectRepository(BlockedUser)
    private readonly blockedUsers: Repository<BlockedUser>,
    // @purge:block-end
    private readonly config: ConfigService,
  ) {}

  /** Shared by E2EE payload validation and the search constraint. */
  private get e2eeEnabled(): boolean {
    return (
      (this.config.get<string>('MESSAGING_E2EE') ?? 'true').toLowerCase() ===
      'true'
    );
  }

  // @purge:e2ee-start
  /**
   * Publish (or rotate) the caller's E2EE public key. Previous versions are
   * revoked so clients always resolve a single current key per user.
   */
  async publishKey(actorId: string, dto: PublishKeyDto): Promise<UserKey> {
    const active = await this.userKeys.find({
      where: { userId: actorId, revokedAt: IsNull() },
      order: { keyVersion: 'DESC' },
    });
    if (active.length > 0) {
      for (const k of active) k.revokedAt = new Date();
      await this.userKeys.save(active);
    }
    const nextVersion = (active[0]?.keyVersion ?? 0) + 1;
    return this.userKeys.save(
      this.userKeys.create({
        userId: actorId,
        publicKey: dto.publicKey,
        signature: dto.signature,
        keyVersion: nextVersion,
      }),
    );
  }

  async getMyKey(userId: string): Promise<UserKey> {
    const key = await this.userKeys.findOne({
      where: { userId, revokedAt: IsNull() },
      order: { keyVersion: 'DESC' },
    });
    if (!key) throw new NotFoundException('No E2EE key published');
    return key;
  }

  async getUserKey(userId: string): Promise<UserKey> {
    const key = await this.userKeys.findOne({
      where: { userId, revokedAt: IsNull() },
      order: { keyVersion: 'DESC' },
    });
    if (!key) throw new NotFoundException('No E2EE key published');
    return key;
  }
  // @purge:e2ee-end

  // @purge:presence-start
  async updatePresence(userId: string, status: string): Promise<Presence> {
    return this.presence.save(
      this.presence.create({
        userId,
        status: status as PresenceStatus,
        lastSeenAt: new Date(),
      }),
    );
  }

  async listPresence(): Promise<Presence[]> {
    return this.presence.find({ order: { lastSeenAt: 'DESC' } });
  }

  async getPresence(userId: string): Promise<Presence> {
    const presence = await this.presence.findOne({ where: { userId } });
    if (!presence) throw new NotFoundException('No presence recorded');
    return presence;
  }
  // @purge:presence-end

  // @purge:receipts-start
  async markMessageRead(
    userId: string,
    messageId: string,
  ): Promise<MessageReceipt> {
    const message = await this.messages.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertMember(userId, message.conversationId);

    // advance the conversation read cursor. The cursor is strictly after the
    // message (`createdAt + 1ms`, or now): DB created_at carries microsecond
    // precision while JS Dates only have milliseconds, so using either value
    // alone could leave the marked message strictly "unread".
    const readAt = new Date(
      Math.max(Date.now(), message.createdAt.getTime() + 1),
    );
    const member = await this.members.findOne({
      where: { userId, conversationId: message.conversationId },
    });
    if (member && (!member.lastReadAt || readAt > member.lastReadAt)) {
      member.lastReadAt = readAt;
      await this.members.save(member);
    }

    const existing = await this.receipts.findOne({
      where: { messageId, userId },
    });
    if (existing) return existing;
    return this.receipts.save(
      this.receipts.create({
        messageId,
        userId,
        status: 'read',
        readAt,
      }),
    );
  }

  async listMessageReceipts(
    userId: string,
    messageId: string,
  ): Promise<MessageReceipt[]> {
    const message = await this.messages.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertMember(userId, message.conversationId);
    return this.receipts.find({ where: { messageId } });
  }

  private async unreadCount(
    conversationId: string,
    userId: string,
    lastReadAt: Date | null,
  ): Promise<number> {
    return this.messages.count({
      where: {
        conversationId,
        senderId: Not(userId),
        createdAt: MoreThan(lastReadAt ?? new Date(0)),
      },
    });
  }
  // @purge:receipts-end

  private async assertMember(
    userId: string,
    conversationId: string,
  ): Promise<ConversationMember> {
    const member = await this.members.findOne({
      where: { userId, conversationId },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
    return member;
  }

  private async loadWithMembers(id: string): Promise<Conversation> {
    const conversation = await this.conversations.findOne({
      where: { id },
      relations: { members: { user: true } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async createDirectConversation(
    actorId: string,
    memberId?: string,
  ): Promise<{ conversation: Conversation; created: boolean }> {
    if (!memberId) {
      throw new BadRequestException(
        'memberId is required for a direct conversation',
      );
    }
    if (memberId === actorId) {
      throw new BadRequestException(
        'Cannot start a conversation with yourself',
      );
    }
    const target = await this.users.findOne({ where: { id: memberId } });
    if (!target) throw new NotFoundException('User not found');
    // @purge:block-start
    const blocked = await this.blockedUsers.findOne({
      where: [
        { blockerId: actorId, blockedId: memberId },
        { blockerId: memberId, blockedId: actorId },
      ],
    });
    if (blocked) {
      throw new ForbiddenException(
        'You cannot start a conversation with this user (blocked)',
      );
    }
    // @purge:block-end

    // find-or-create: a direct pair always maps to a single conversation
    const mine = await this.members.find({
      where: { userId: actorId },
      relations: { conversation: true },
    });
    for (const cm of mine) {
      if (cm.conversation.type !== 'direct') continue;
      const other = await this.members.findOne({
        where: { conversationId: cm.conversationId, userId: memberId },
      });
      if (other) {
        return {
          conversation: await this.loadWithMembers(cm.conversationId),
          created: false,
        };
      }
    }

    const saved = await this.conversations.save(
      this.conversations.create({
        type: 'direct',
        createdById: actorId,
      }),
    );
    await this.members.save([
      this.members.create({
        conversationId: saved.id,
        userId: actorId,
        role: 'admin',
      }),
      this.members.create({
        conversationId: saved.id,
        userId: memberId,
        role: 'member',
      }),
    ]);
    return {
      conversation: await this.loadWithMembers(saved.id),
      created: true,
    };
  }

  // @purge:groups-start
  private async assertGroupAdmin(
    actorId: string,
    conversationId: string,
  ): Promise<ConversationMember> {
    const member = await this.assertMember(actorId, conversationId);
    if (member.role !== 'admin') {
      throw new ForbiddenException('Group admin required');
    }
    return member;
  }

  private async assertGroup(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type !== 'group') {
      throw new BadRequestException('Not a group conversation');
    }
    return conversation;
  }

  async createGroupConversation(
    actorId: string,
    dto: CreateConversationDto,
  ): Promise<{ conversation: Conversation; created: boolean }> {
    if (!dto.title) throw new BadRequestException('Group title is required');
    const memberIds = [...new Set(dto.memberIds ?? [])];
    if (memberIds.length === 0) {
      throw new BadRequestException('At least one member is required');
    }
    if (memberIds.includes(actorId)) {
      throw new BadRequestException(
        'You are already a group member — do not include yourself',
      );
    }
    const targets = await this.users.find({ where: { id: In(memberIds) } });
    if (targets.length !== memberIds.length) {
      throw new NotFoundException('Some group members do not exist');
    }
    const saved = await this.conversations.save(
      this.conversations.create({
        type: 'group',
        title: dto.title,
        createdById: actorId,
      }),
    );
    const allIds = [actorId, ...memberIds];
    await this.members.save(
      allIds.map((userId) =>
        this.members.create({
          conversationId: saved.id,
          userId,
          role: userId === actorId ? 'admin' : 'member',
          wrappedConversationKey:
            dto.memberKeys?.find((k) => k.userId === userId)?.key ?? null,
          keyVersion: 1,
        }),
      ),
    );
    return {
      conversation: await this.loadWithMembers(saved.id),
      created: true,
    };
  }

  async addGroupMember(
    actorId: string,
    conversationId: string,
    dto: AddMemberDto,
  ): Promise<Conversation> {
    await this.assertGroupAdmin(actorId, conversationId);
    await this.assertGroup(conversationId);
    const target = await this.users.findOne({ where: { id: dto.userId } });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.members.findOne({
      where: { conversationId, userId: dto.userId },
    });
    if (existing) {
      throw new BadRequestException('User is already a member');
    }
    await this.members.save(
      this.members.create({
        conversationId,
        userId: dto.userId,
        role: 'member',
        wrappedConversationKey: dto.wrappedKey ?? null,
        keyVersion: 1,
      }),
    );
    return this.loadWithMembers(conversationId);
  }

  /**
   * Remove a member (admin only). If `newWrappedKeys` is provided (E2EE), the
   * conversation key is rotated: each remaining member's current wrapped key
   * is archived into ConversationMemberKey (its version) and replaced by the
   * new wrapped key (version + 1) so the removed member can no longer decrypt
   * future messages while old messages stay readable.
   */
  async removeGroupMember(
    actorId: string,
    conversationId: string,
    targetUserId: string,
    dto: RemoveMemberDto,
  ): Promise<Conversation> {
    await this.assertGroupAdmin(actorId, conversationId);
    await this.assertGroup(conversationId);
    const target = await this.members.findOne({
      where: { conversationId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');

    const newKeys = dto.newWrappedKeys ?? [];
    if (newKeys.length > 0) {
      for (const entry of newKeys) {
        const member = await this.members.findOne({
          where: { conversationId, userId: entry.userId },
        });
        if (!member || member.userId === targetUserId) continue;
        if (member.wrappedConversationKey) {
          await this.memberKeys.save(
            this.memberKeys.create({
              conversationId,
              userId: member.userId,
              keyVersion: member.keyVersion,
              wrappedKey: member.wrappedConversationKey,
            }),
          );
        }
        member.wrappedConversationKey = entry.key;
        member.keyVersion += 1;
        await this.members.save(member);
      }
    }

    await this.members.delete({ conversationId, userId: targetUserId });
    await this.memberKeys.delete({
      conversationId,
      userId: targetUserId,
    });
    const remaining = await this.members.count({ where: { conversationId } });
    if (remaining === 0) {
      await this.conversations.delete({ id: conversationId });
    }
    return this.loadWithMembers(conversationId);
  }

  async updateGroupMember(
    actorId: string,
    conversationId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ): Promise<Conversation> {
    await this.assertGroupAdmin(actorId, conversationId);
    const target = await this.members.findOne({
      where: { conversationId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (dto.role !== undefined) target.role = dto.role as never;
    if (dto.muted !== undefined) target.muted = dto.muted;
    await this.members.save(target);
    return this.loadWithMembers(conversationId);
  }
  // @purge:groups-end

  async listMyConversations(userId: string): Promise<Conversation[]> {
    const rows = await this.members.find({
      where: { userId },
      relations: { conversation: { members: { user: true } } },
    });
    const conversations = rows
      .map((r) => r.conversation)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    // @purge:receipts-start
    for (const c of conversations) {
      const member = rows.find((r) => r.conversationId === c.id)!;
      (c as unknown as { unreadCount: number }).unreadCount =
        await this.unreadCount(c.id, userId, member.lastReadAt);
    }
    // @purge:receipts-end
    return conversations;
  }

  async getConversation(userId: string, id: string): Promise<Conversation> {
    await this.assertMember(userId, id);
    return this.loadWithMembers(id);
  }

  async leaveConversation(userId: string, id: string): Promise<void> {
    await this.assertMember(userId, id);
    await this.members.delete({ userId, conversationId: id });
    const remaining = await this.members.count({
      where: { conversationId: id },
    });
    if (remaining === 0) {
      await this.conversations.delete({ id });
    }
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: { before?: string; limit?: number; search?: string },
  ): Promise<Message[]> {
    await this.assertMember(userId, conversationId);
    const limit = query.limit ?? 50;
    const qb = this.messages
      .createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: conversationId })
      .orderBy('m.createdAt', 'DESC')
      .take(limit);
    if (query.before) {
      qb.andWhere('m.createdAt < :before', { before: new Date(query.before) });
    }
    // @purge:search-start
    const search = query.search?.trim();
    if (search) {
      if (this.e2eeEnabled) {
        throw new BadRequestException(
          'Server-side search is disabled when E2EE is enabled',
        );
      }
      qb.andWhere('m.content ILIKE :search', { search: `%${search}%` });
    }
    // @purge:search-end

    const messages = await qb.getMany();
    // @purge:replies-start
    return this.attachReplyTo(messages);
    // @purge:replies-end
    return messages;
  }

  // @purge:replies-start
  private async attachReplyTo(msgs: Message[]): Promise<Message[]> {
    const ids = msgs
      .map((m) => m.replyToId)
      .filter((x): x is string => Boolean(x));
    if (ids.length === 0) return msgs;
    const refs = await this.messages.find({ where: { id: In(ids) } });
    const byId = new Map(refs.map((r) => [r.id, r]));
    for (const m of msgs) {
      if (m.replyToId) {
        (m as unknown as { replyTo?: Message | null }).replyTo =
          byId.get(m.replyToId) ?? null;
      }
    }
    return msgs;
  }

  async listMessageReplies(
    userId: string,
    messageId: string,
  ): Promise<Message[]> {
    const message = await this.messages.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertMember(userId, message.conversationId);
    return this.messages.find({
      where: { replyToId: messageId },
      order: { createdAt: 'ASC' },
    });
  }
  // @purge:replies-end

  // @purge:edit-delete-start
  async editMessage(
    userId: string,
    messageId: string,
    content: string,
  ): Promise<Message> {
    const message = await this.messages.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertMember(userId, message.conversationId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can edit a message');
    }
    if (message.deletedAt) {
      throw new BadRequestException('Message has been deleted');
    }
    message.content = content;
    message.editedAt = new Date();
    return this.messages.save(message);
  }

  async deleteMessage(userId: string, messageId: string): Promise<Message> {
    const message = await this.messages.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertMember(userId, message.conversationId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can delete a message');
    }
    if (message.deletedAt) {
      throw new BadRequestException('Message has already been deleted');
    }
    message.deletedAt = new Date();
    return this.messages.save(message);
  }
  // @purge:edit-delete-end

  // @purge:block-start
  private async assertNotBlockedInConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (!conversation || conversation.type !== 'direct') return;
    const other = await this.members.findOne({
      where: { conversationId, userId: Not(userId) },
    });
    if (!other) return;
    const blocked = await this.blockedUsers.findOne({
      where: [
        { blockerId: other.userId, blockedId: userId },
        { blockerId: userId, blockedId: other.userId },
      ],
    });
    if (blocked) {
      throw new ForbiddenException(
        'You cannot send messages to this user (blocked)',
      );
    }
  }

  async blockUser(actorId: string, userId: string): Promise<BlockedUser> {
    if (userId === actorId) {
      throw new BadRequestException('You cannot block yourself');
    }
    const target = await this.users.findOne({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.blockedUsers.findOne({
      where: { blockerId: actorId, blockedId: userId },
    });
    if (existing) return existing;
    return this.blockedUsers.save(
      this.blockedUsers.create({ blockerId: actorId, blockedId: userId }),
    );
  }

  async unblockUser(actorId: string, userId: string): Promise<void> {
    await this.blockedUsers.delete({ blockerId: actorId, blockedId: userId });
  }

  async listBlocks(actorId: string): Promise<BlockedUser[]> {
    return this.blockedUsers.find({
      where: { blockerId: actorId },
      order: { createdAt: 'DESC' },
    });
  }
  // @purge:block-end

  /** Admin: browse every conversation (`messaging.admin.read`). */
  async listAllConversations(): Promise<Conversation[]> {
    return this.conversations.find({
      relations: { members: { user: true } },
      order: { updatedAt: 'DESC' },
    });
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: CreateMessageDto,
  ): Promise<Message> {
    await this.assertMember(userId, conversationId);
    // @purge:block-start
    await this.assertNotBlockedInConversation(userId, conversationId);
    // @purge:block-end
    // @purge:replies-start
    if (dto.replyToId) {
      const replyTo = await this.messages.findOne({
        where: { id: dto.replyToId },
      });
      if (!replyTo || replyTo.conversationId !== conversationId) {
        throw new BadRequestException(
          'replyTo message not found in this conversation',
        );
      }
    }
    // @purge:replies-end
    // @purge:e2ee-start
    const useE2ee = this.e2eeEnabled && dto.e2ee !== false;
    if (useE2ee) {
      if (!dto.iv || !dto.wrappedKeys || dto.wrappedKeys.length === 0) {
        throw new BadRequestException(
          'E2EE payload requires iv and wrappedKeys',
        );
      }
    }
    // @purge:e2ee-end
    return this.messages.save(
      this.messages.create({
        conversationId,
        senderId: userId,
        content: dto.content,
        // @purge:replies-start
        replyToId: dto.replyToId ?? null,
        // @purge:replies-end
        // @purge:e2ee-start
        iv: useE2ee ? dto.iv : null,
        wrappedKeys: useE2ee ? dto.wrappedKeys : null,
        e2ee: useE2ee,
        // @purge:e2ee-end
      }),
    );
  }

  // @purge:realtime-start
  async listConversationIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.members.find({
      where: { userId },
      select: { conversationId: true },
    });
    return rows.map((r) => r.conversationId);
  }

  async getMessageConversationId(messageId: string): Promise<string> {
    const message = await this.messages.findOne({
      where: { id: messageId },
      select: { conversationId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message.conversationId;
  }
  // @purge:realtime-end

  // @purge:typing-start
  async isMember(userId: string, conversationId: string): Promise<boolean> {
    const member = await this.members.findOne({
      where: { userId, conversationId },
    });
    return member !== null;
  }
  // @purge:typing-end
}
