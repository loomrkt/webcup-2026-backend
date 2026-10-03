import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message } from './entities/message.entity';

jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeRepo() {
  const qb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
}

describe('MessagingService', () => {
  let service: MessagingService;
  const conversations = makeRepo();
  const members = makeRepo();
  const messages = makeRepo();
  const users = makeRepo();
  const userKeys = makeRepo();
  const presence = makeRepo();
  const receipts = makeRepo();
  const memberKeys = makeRepo();
  const blockedUsers = makeRepo();
  const config = { get: jest.fn() };
  const qb = messages.createQueryBuilder();

  beforeEach(() => {
    jest.resetAllMocks();
    qb.where.mockReturnThis();
    qb.orderBy.mockReturnThis();
    qb.andWhere.mockReturnThis();
    qb.take.mockReturnThis();
    qb.getMany.mockResolvedValue([]);
    messages.createQueryBuilder.mockImplementation(() => qb);
    config.get.mockReturnValue('true'); // MESSAGING_E2EE on
    service = new MessagingService(
      conversations as never,
      members as never,
      messages as never,
      users as never,
      userKeys as never,
      presence as never,
      receipts as never,
      memberKeys as never,
      blockedUsers as never,
      config as never,
    );
  });

  describe('createDirectConversation', () => {
    it('rejects starting a conversation with yourself', async () => {
      await expect(
        service.createDirectConversation('u1', 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown target user', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(
        service.createDirectConversation('u1', 'u2'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the existing conversation for an already-connected pair', async () => {
      users.findOne.mockResolvedValue({ id: 'u2' });
      members.find.mockResolvedValue([
        {
          conversationId: 'c1',
          conversation: { id: 'c1', type: 'direct' } as Conversation,
        },
      ]);
      members.findOne.mockResolvedValue({ userId: 'u2' });
      conversations.findOne.mockResolvedValue({
        id: 'c1',
        members: [{ userId: 'u1' }, { userId: 'u2' }],
      });

      const result = await service.createDirectConversation('u1', 'u2');
      expect(result.created).toBe(false);
      expect(result.conversation.id).toBe('c1');
      expect(conversations.save).not.toHaveBeenCalled();
    });

    it('creates the conversation with two members when the pair is new', async () => {
      users.findOne.mockResolvedValue({ id: 'u2' });
      members.find.mockResolvedValue([] as ConversationMember[]);
      conversations.create.mockReturnValue({
        type: 'direct',
        createdById: 'u1',
      });
      conversations.save.mockResolvedValue({ id: 'c1' });
      conversations.findOne.mockResolvedValue({
        id: 'c1',
        members: [{ userId: 'u1' }, { userId: 'u2' }],
      });
      members.create.mockImplementation((arg: object) => ({ ...arg }));

      const result = await service.createDirectConversation('u1', 'u2');
      expect(result.created).toBe(true);
      expect(conversations.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'direct', createdById: 'u1' }),
      );
      expect(members.save).toHaveBeenCalledWith([
        expect.objectContaining({ conversationId: 'c1', userId: 'u1' }),
        expect.objectContaining({ conversationId: 'c1', userId: 'u2' }),
      ]);
    });
  });

  describe('getConversation', () => {
    it('forbids non-members', async () => {
      members.findOne.mockResolvedValue(null);
      await expect(service.getConversation('u1', 'c1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns the conversation for a member', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      conversations.findOne.mockResolvedValue({
        id: 'c1',
        members: [],
      });
      const conv = await service.getConversation('u1', 'c1');
      expect(conv.id).toBe('c1');
      expect(conversations.findOne).toHaveBeenCalledWith({
        where: { id: 'c1' },
        relations: { members: { user: true } },
      });
    });
  });

  describe('leaveConversation', () => {
    it('forbids non-members', async () => {
      members.findOne.mockResolvedValue(null);
      await expect(
        service.leaveConversation('u1', 'c1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('removes the member and deletes the conversation when empty', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      members.count.mockResolvedValue(0);
      await service.leaveConversation('u1', 'c1');
      expect(members.delete).toHaveBeenCalledWith({
        userId: 'u1',
        conversationId: 'c1',
      });
      expect(conversations.delete).toHaveBeenCalledWith({ id: 'c1' });
    });

    it('keeps the conversation when other members remain', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      members.count.mockResolvedValue(1);
      await service.leaveConversation('u1', 'c1');
      expect(conversations.delete).not.toHaveBeenCalled();
    });
  });

  describe('listMessages', () => {
    it('forbids non-members', async () => {
      members.findOne.mockResolvedValue(null);
      await expect(service.listMessages('u1', 'c1', {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('paginates with the before cursor and limit', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      qb.getMany.mockResolvedValue([{ id: 'm2' }, { id: 'm1' }] as Message[]);
      const result = await service.listMessages('u1', 'c1', {
        before: '2026-01-01T00:00:00.000Z',
        limit: 20,
      });
      expect(result).toHaveLength(2);
      expect(messages.createQueryBuilder).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('m.conversationId = :cid', {
        cid: 'c1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'm.createdAt < :before',
        expect.any(Object),
      );
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('sendMessage', () => {
    it('forbids non-members', async () => {
      members.findOne.mockResolvedValue(null);
      await expect(
        service.sendMessage('u1', 'c1', { content: 'hello', e2ee: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('stores a plaintext message when e2ee:false', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      messages.create.mockReturnValue({ conversationId: 'c1' });
      messages.save.mockResolvedValue({ id: 'm1' });
      await service.sendMessage('u1', 'c1', {
        content: 'hello',
        e2ee: false,
      });
      expect(messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'c1',
          senderId: 'u1',
          content: 'hello',
          iv: null,
          wrappedKeys: null,
          e2ee: false,
        }),
      );
    });

    it('rejects an E2EE payload without iv/wrappedKeys', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      await expect(
        service.sendMessage('u1', 'c1', {
          content: 'cipher',
          iv: 'base64iv',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores the E2EE payload when iv and wrappedKeys are provided', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      messages.create.mockReturnValue({ conversationId: 'c1' });
      messages.save.mockResolvedValue({ id: 'm1' });
      await service.sendMessage('u1', 'c1', {
        content: 'ciphertext-blob',
        iv: 'aGVsbG8td29ybGQ=',
        wrappedKeys: [{ userId: 'u2', key: 'wrapped-key-blob-xxxx' }],
      });
      expect(messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'ciphertext-blob',
          iv: 'aGVsbG8td29ybGQ=',
          wrappedKeys: [{ userId: 'u2', key: 'wrapped-key-blob-xxxx' }],
          e2ee: true,
        }),
      );
    });

    it('ignores the E2EE payload when MESSAGING_E2EE=false', async () => {
      config.get.mockReturnValue('false');
      members.findOne.mockResolvedValue({ userId: 'u1' });
      messages.create.mockReturnValue({ conversationId: 'c1' });
      messages.save.mockResolvedValue({ id: 'm1' });
      await service.sendMessage('u1', 'c1', {
        content: 'plain',
        iv: 'whatever',
        wrappedKeys: [{ userId: 'u2', key: 'wrapped-key-blob-xxxx' }],
      });
      expect(messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'plain',
          iv: null,
          wrappedKeys: null,
          e2ee: false,
        }),
      );
    });
  });

  describe('E2EE keys', () => {
    it('publishKey revokes previous versions and bumps the version', async () => {
      userKeys.find.mockResolvedValue([
        { id: 'k1', userId: 'u1', keyVersion: 1 },
      ]);
      userKeys.create.mockImplementation((arg: object) => ({ ...arg }));
      userKeys.save.mockResolvedValue({ id: 'k2' });
      const result = await service.publishKey('u1', {
        publicKey: 'pubkey-base64-blob-xxxx',
        signature: 'signature-base64-blob-xxxx',
      });
      expect(result.id).toBe('k2');
      expect(userKeys.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', keyVersion: 2 }),
      );
      const saveMock = userKeys.save as jest.Mock<unknown, unknown[]>;
      const revokeArgs = saveMock.mock.calls[0][0] as Array<{
        id: string;
        revokedAt: Date;
      }>;
      expect(revokeArgs[0]).toMatchObject({ id: 'k1' });
      expect(revokeArgs[0].revokedAt).toBeInstanceOf(Date);
    });

    it('publishKey starts at version 1 when no key exists', async () => {
      userKeys.find.mockResolvedValue([]);
      userKeys.create.mockImplementation((arg: object) => ({ ...arg }));
      userKeys.save.mockResolvedValue({ id: 'k1' });
      await service.publishKey('u1', {
        publicKey: 'pubkey-base64-blob-xxxx',
        signature: 'signature-base64-blob-xxxx',
      });
      expect(userKeys.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', keyVersion: 1 }),
      );
    });

    it('getMyKey returns the active key or 404', async () => {
      userKeys.findOne.mockResolvedValue({ id: 'k2', keyVersion: 2 });
      expect((await service.getMyKey('u1')).keyVersion).toBe(2);

      userKeys.findOne.mockResolvedValue(null);
      await expect(service.getMyKey('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('getUserKey returns the active key of another user or 404', async () => {
      userKeys.findOne.mockResolvedValue(null);
      await expect(service.getUserKey('u2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('presence', () => {
    it('updatePresence upserts the status', async () => {
      presence.create.mockImplementation((arg: object) => ({ ...arg }));
      presence.save.mockResolvedValue({ userId: 'u1', status: 'online' });
      const result = await service.updatePresence('u1', 'online');
      expect(presence.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', status: 'online' }),
      );
      expect(result.status).toBe('online');
    });

    it('getPresence returns the row or 404', async () => {
      presence.findOne.mockResolvedValue({ userId: 'u1', status: 'away' });
      expect((await service.getPresence('u1')).status).toBe('away');

      presence.findOne.mockResolvedValue(null);
      await expect(service.getPresence('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('listPresence returns all rows', async () => {
      presence.find.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      expect(await service.listPresence()).toHaveLength(2);
    });
  });

  describe('receipts', () => {
    it('markMessageRead: unknown message → 404', async () => {
      messages.findOne.mockResolvedValue(null);
      await expect(service.markMessageRead('u1', 'm1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('markMessageRead: non-member → 403', async () => {
      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        createdAt: new Date(),
      });
      members.findOne.mockResolvedValue(null);
      await expect(service.markMessageRead('u1', 'm1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('markMessageRead advances the cursor and creates a receipt', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        createdAt,
      });
      members.findOne.mockResolvedValue({
        userId: 'u1',
        conversationId: 'c1',
        lastReadAt: null,
      });
      members.save.mockResolvedValue({});
      receipts.findOne.mockResolvedValue(null);
      receipts.create.mockImplementation((arg: object) => ({ ...arg }));
      receipts.save.mockResolvedValue({
        messageId: 'm1',
        userId: 'u1',
        status: 'read',
      });
      const receipt = await service.markMessageRead('u1', 'm1');
      const saveMock = members.save as jest.Mock<unknown, unknown[]>;
      const savedMember = saveMock.mock.calls[0][0] as { lastReadAt: Date };
      expect(savedMember.lastReadAt).toBeInstanceOf(Date);
      expect(savedMember.lastReadAt.getTime()).toBeGreaterThan(
        createdAt.getTime(),
      );
      expect(receipts.create).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'm1', userId: 'u1' }),
      );
      expect(receipt.status).toBe('read');
    });

    it('markMessageRead returns the existing receipt (idempotent)', async () => {
      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        createdAt: new Date(),
      });
      members.findOne.mockResolvedValue({
        userId: 'u1',
        conversationId: 'c1',
        lastReadAt: new Date(),
      });
      const existing = { messageId: 'm1', userId: 'u1', status: 'read' };
      receipts.findOne.mockResolvedValue(existing);
      expect(await service.markMessageRead('u1', 'm1')).toBe(existing);
    });

    it('listMessageReceipts: non-member → 403; member → receipts', async () => {
      messages.findOne.mockResolvedValue({ id: 'm1', conversationId: 'c1' });
      members.findOne.mockResolvedValue(null);
      await expect(
        service.listMessageReceipts('u1', 'm1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      members.findOne.mockResolvedValue({
        userId: 'u1',
        conversationId: 'c1',
      });
      receipts.find.mockResolvedValue([{ userId: 'u2' }]);
      expect(await service.listMessageReceipts('u1', 'm1')).toHaveLength(1);
    });

    it('listMyConversations attaches unread counts', async () => {
      members.find.mockResolvedValue([
        {
          conversationId: 'c1',
          userId: 'u1',
          lastReadAt: null,
          conversation: { id: 'c1', updatedAt: new Date() },
        },
      ]);
      messages.count.mockResolvedValue(3);
      const convs = await service.listMyConversations('u1');
      expect((convs[0] as unknown as { unreadCount: number }).unreadCount).toBe(
        3,
      );
      expect(messages.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('groups', () => {
    it('createGroupConversation requires a title and members', async () => {
      await expect(
        service.createGroupConversation('u1', { memberIds: ['u2'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createGroupConversation('u1', { title: 'Team' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('createGroupConversation rejects including yourself or unknown users', async () => {
      await expect(
        service.createGroupConversation('u1', {
          title: 'Team',
          memberIds: ['u1'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      users.find.mockResolvedValue([{ id: 'u2' }]);
      await expect(
        service.createGroupConversation('u1', {
          title: 'Team',
          memberIds: ['u2', 'u9'],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a group with the actor as admin and wrapped keys stored', async () => {
      users.find.mockResolvedValue([{ id: 'u2' }, { id: 'u3' }]);
      conversations.create.mockReturnValue({ type: 'group', title: 'Team' });
      conversations.save.mockResolvedValue({ id: 'g1' });
      conversations.findOne.mockResolvedValue({
        id: 'g1',
        type: 'group',
        members: [],
      });
      members.create.mockImplementation((arg: object) => ({ ...arg }));
      members.save.mockResolvedValue({});

      const result = await service.createGroupConversation('u1', {
        title: 'Team',
        memberIds: ['u2', 'u3'],
        memberKeys: [
          { userId: 'u1', key: 'wrapped-key-actor-xxxxxxxxxxxx' },
          { userId: 'u2', key: 'wrapped-key-u2-xxxxxxxxxxxxxx' },
        ],
      });
      expect(result.created).toBe(true);
      expect(conversations.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'group', title: 'Team' }),
      );
      const saveMock = members.save as jest.Mock<unknown, unknown[]>;
      const membersArg = saveMock.mock.calls[0][0] as Array<{
        userId: string;
        role: string;
        wrappedConversationKey: string | null;
      }>;
      expect(membersArg).toHaveLength(3);
      expect(membersArg[0]).toMatchObject({
        userId: 'u1',
        role: 'admin',
        wrappedConversationKey: 'wrapped-key-actor-xxxxxxxxxxxx',
      });
      expect(membersArg[1]).toMatchObject({
        userId: 'u2',
        role: 'member',
        wrappedConversationKey: 'wrapped-key-u2-xxxxxxxxxxxxxx',
      });
      expect(membersArg[2]).toMatchObject({ userId: 'u3' });
    });

    it('addGroupMember requires an admin', async () => {
      members.findOne.mockResolvedValue({ role: 'member' });
      await expect(
        service.addGroupMember('u1', 'g1', { userId: 'u2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('addGroupMember only works on group conversations', async () => {
      members.findOne.mockResolvedValue({ role: 'admin' });
      conversations.findOne.mockResolvedValue({
        id: 'g1',
        type: 'direct',
      });
      await expect(
        service.addGroupMember('u1', 'g1', { userId: 'u2' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('addGroupMember adds the member with the wrapped key', async () => {
      members.findOne
        .mockResolvedValueOnce({ role: 'admin' }) // assertGroupAdmin
        .mockResolvedValueOnce(null); // not a member yet
      conversations.findOne.mockResolvedValue({ id: 'g1', type: 'group' });
      users.findOne.mockResolvedValue({ id: 'u2' });
      members.create.mockImplementation((arg: object) => ({ ...arg }));
      members.save.mockResolvedValue({});
      await service.addGroupMember('u1', 'g1', {
        userId: 'u2',
        wrappedKey: 'wrapped-key-u2-xxxxxxxxxxxxxx',
      });
      expect(members.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'g1',
          userId: 'u2',
          role: 'member',
          wrappedConversationKey: 'wrapped-key-u2-xxxxxxxxxxxxxx',
        }),
      );
    });

    it('removeGroupMember archives keys and bumps versions (rotation)', async () => {
      members.findOne
        .mockResolvedValueOnce({ role: 'admin' }) // assertGroupAdmin
        .mockResolvedValueOnce({ role: 'member' }) // target u2
        .mockResolvedValueOnce({
          // remaining member u1
          userId: 'u1',
          keyVersion: 1,
          wrappedConversationKey: 'old-wrapped-key-xxxxxxxxxxxxx',
        });
      conversations.findOne.mockResolvedValue({ id: 'g1', type: 'group' });
      memberKeys.create.mockImplementation((arg: object) => ({ ...arg }));
      memberKeys.save.mockResolvedValue({});
      members.save.mockResolvedValue({});
      members.count.mockResolvedValue(1);
      conversations.findOne.mockResolvedValue({
        id: 'g1',
        type: 'group',
        members: [{ userId: 'u1' }],
      });

      await service.removeGroupMember('u1', 'g1', 'u2', {
        newWrappedKeys: [
          { userId: 'u1', key: 'new-wrapped-key-xxxxxxxxxxxxx' },
        ],
      });

      expect(memberKeys.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'g1',
          userId: 'u1',
          keyVersion: 1,
          wrappedKey: 'old-wrapped-key-xxxxxxxxxxxxx',
        }),
      );
      expect(members.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          wrappedConversationKey: 'new-wrapped-key-xxxxxxxxxxxxx',
          keyVersion: 2,
        }),
      );
      expect(members.delete).toHaveBeenCalledWith({
        conversationId: 'g1',
        userId: 'u2',
      });
      expect(memberKeys.delete).toHaveBeenCalledWith({
        conversationId: 'g1',
        userId: 'u2',
      });
    });

    it('updateGroupMember sets role and mute (admin only)', async () => {
      members.findOne.mockResolvedValueOnce({ role: 'admin' });
      members.findOne.mockResolvedValueOnce({
        userId: 'u2',
        role: 'member',
        muted: false,
      });
      members.save.mockResolvedValue({});
      conversations.findOne.mockResolvedValue({
        id: 'g1',
        type: 'group',
        members: [],
      });
      await service.updateGroupMember('u1', 'g1', 'u2', {
        role: 'admin',
        muted: true,
      });
      expect(members.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin', muted: true }),
      );
    });
  });

  describe('replies', () => {
    it('rejects a replyToId from another conversation', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      messages.findOne.mockResolvedValue({ id: 'm9', conversationId: 'other' });
      await expect(
        service.sendMessage('u1', 'c1', {
          content: 'hi',
          replyToId: 'm9',
          e2ee: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores replyToId when the referenced message is in the conversation', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      messages.findOne.mockResolvedValue({ id: 'm1', conversationId: 'c1' });
      messages.create.mockImplementation((arg: object) => ({ ...arg }));
      messages.save.mockResolvedValue({});
      await service.sendMessage('u1', 'c1', {
        content: 'reply',
        replyToId: 'm1',
        e2ee: false,
      });
      expect(messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ replyToId: 'm1' }),
      );
    });

    it('listMessageReplies returns the thread (member only)', async () => {
      messages.findOne.mockResolvedValue({ id: 'm1', conversationId: 'c1' });
      members.findOne.mockResolvedValue(null);
      await expect(
        service.listMessageReplies('u1', 'm1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      members.findOne.mockResolvedValue({ userId: 'u1' });
      messages.find.mockResolvedValue([{ id: 'm2', replyToId: 'm1' }]);
      expect(await service.listMessageReplies('u1', 'm1')).toHaveLength(1);
    });

    it('listMessages attaches the replyTo message', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      qb.getMany.mockResolvedValue([
        { id: 'm2', replyToId: 'm1' },
        { id: 'm1', replyToId: null },
      ] as Message[]);
      messages.find.mockResolvedValue([{ id: 'm1', content: 'orig' }]);
      const result = await service.listMessages('u1', 'c1', {});
      expect(
        (result[0] as unknown as { replyTo?: { id: string } }).replyTo?.id,
      ).toBe('m1');
    });
  });

  describe('edit & delete', () => {
    it('editMessage: only the sender, not deleted', async () => {
      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u2',
        deletedAt: null,
      });
      members.findOne.mockResolvedValue({ userId: 'u1' });
      await expect(
        service.editMessage('u1', 'm1', 'new'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u1',
        deletedAt: new Date(),
      });
      await expect(
        service.editMessage('u1', 'm1', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('editMessage updates content and sets editedAt', async () => {
      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u1',
        deletedAt: null,
      });
      members.findOne.mockResolvedValue({ userId: 'u1' });
      messages.save.mockImplementation((m: object) => Promise.resolve(m));
      const edited = await service.editMessage('u1', 'm1', 'new content');
      expect((edited as unknown as { content: string }).content).toBe(
        'new content',
      );
      expect((edited as unknown as { editedAt: Date }).editedAt).toBeInstanceOf(
        Date,
      );
    });

    it('deleteMessage soft-deletes (sender only)', async () => {
      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u2',
        deletedAt: null,
      });
      members.findOne.mockResolvedValue({ userId: 'u1' });
      await expect(service.deleteMessage('u1', 'm1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      messages.findOne.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u1',
        deletedAt: null,
      });
      messages.save.mockImplementation((m: object) => Promise.resolve(m));
      const deleted = await service.deleteMessage('u1', 'm1');
      expect(
        (deleted as unknown as { deletedAt: Date }).deletedAt,
      ).toBeInstanceOf(Date);
    });
  });

  describe('search', () => {
    it('rejects server-side search while E2EE is enabled', async () => {
      members.findOne.mockResolvedValue({ userId: 'u1' });
      await expect(
        service.listMessages('u1', 'c1', { search: 'foo' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('filters with ILIKE when E2EE is off', async () => {
      config.get.mockReturnValue('false');
      members.findOne.mockResolvedValue({ userId: 'u1' });
      qb.getMany.mockResolvedValue([{ id: 'm1' }] as Message[]);
      await service.listMessages('u1', 'c1', { search: 'foo' });
      expect(qb.andWhere).toHaveBeenCalledWith('m.content ILIKE :search', {
        search: '%foo%',
      });
    });
  });

  describe('block', () => {
    it('blockUser validates and is idempotent', async () => {
      await expect(service.blockUser('u1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      users.findOne.mockResolvedValue(null);
      await expect(service.blockUser('u1', 'u9')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      users.findOne.mockResolvedValue({ id: 'u2' });
      blockedUsers.findOne.mockResolvedValue({
        blockerId: 'u1',
        blockedId: 'u2',
      });
      expect(await service.blockUser('u1', 'u2')).toEqual({
        blockerId: 'u1',
        blockedId: 'u2',
      });
    });

    it('blocks conversation creation in either direction', async () => {
      users.findOne.mockResolvedValue({ id: 'u2' });
      members.find.mockResolvedValue([]);
      blockedUsers.findOne.mockResolvedValue({
        blockerId: 'u2',
        blockedId: 'u1',
      });
      await expect(
        service.createDirectConversation('u1', 'u2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks sending in a direct conversation when either side blocked', async () => {
      members.findOne
        .mockResolvedValueOnce({ userId: 'u1' }) // assertMember
        .mockResolvedValueOnce({ userId: 'u2' }); // the other member
      conversations.findOne.mockResolvedValue({ id: 'c1', type: 'direct' });
      blockedUsers.findOne.mockResolvedValue({
        blockerId: 'u1',
        blockedId: 'u2',
      });
      await expect(
        service.sendMessage('u1', 'c1', { content: 'hi', e2ee: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('unblock and list', async () => {
      blockedUsers.delete.mockResolvedValue({});
      await service.unblockUser('u1', 'u2');
      expect(blockedUsers.delete).toHaveBeenCalledWith({
        blockerId: 'u1',
        blockedId: 'u2',
      });
      blockedUsers.find.mockResolvedValue([{ blockerId: 'u1' }]);
      expect(await service.listBlocks('u1')).toHaveLength(1);
    });
  });

  describe('admin', () => {
    it('listAllConversations loads members', async () => {
      conversations.find.mockResolvedValue([{ id: 'c1' }]);
      const result = await service.listAllConversations();
      expect(result).toHaveLength(1);
      expect(conversations.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { members: { user: true } } }),
      );
    });
  });
});
