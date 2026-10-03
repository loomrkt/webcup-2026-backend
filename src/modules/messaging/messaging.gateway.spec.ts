import 'reflect-metadata';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';
import { TokenService } from '../auth/services/token.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeSocket(overrides: Record<string, unknown> = {}) {
  const socket = {
    data: {},
    handshake: { headers: {}, auth: {} },
    join: jest.fn().mockResolvedValue(undefined),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    ...overrides,
  };
  return socket;
}

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  const messaging = {
    listConversationIdsForUser: jest.fn(),
    updatePresence: jest.fn(),
    isMember: jest.fn(),
  };
  const tokens = { verifyAccessToken: jest.fn() };
  const config = { get: jest.fn() };
  const server = {
    use: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('true');
    messaging.updatePresence.mockImplementation((_u: string, s: string) =>
      Promise.resolve({ userId: 'u1', status: s }),
    );
    gateway = new MessagingGateway(
      messaging as unknown as MessagingService,
      tokens as unknown as TokenService,
      config as never,
    );
    gateway.server = server as never;
  });

  describe('afterInit (handshake auth)', () => {
    function middleware(): (s: unknown, next: (e?: unknown) => void) => void {
      gateway.afterInit(server as never);
      const useMock = server.use;
      const calls = useMock.mock.calls as unknown as Array<Array<unknown>>;
      return calls[0][0] as (s: unknown, next: (e?: unknown) => void) => void;
    }

    it('rejects connections without a token', () => {
      const fn = middleware();
      const next = jest.fn();
      fn(makeSocket(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('rejects connections with an invalid token', () => {
      const fn = middleware();
      tokens.verifyAccessToken.mockImplementation(() => {
        throw new Error('bad token');
      });
      const next = jest.fn();
      fn(
        makeSocket({
          handshake: { headers: { authorization: 'Bearer nope' }, auth: {} },
        }),
        next,
      );
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('accepts a valid token and stores the user id', () => {
      const fn = middleware();
      tokens.verifyAccessToken.mockReturnValue({ sub: 'u1' });
      const socket = makeSocket({
        handshake: {
          headers: { authorization: 'Bearer good.token' },
          auth: {},
        },
      });
      const next = jest.fn();
      fn(socket, next);
      expect((socket.data as { userId: string }).userId).toBe('u1');
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('handleConnection', () => {
    it('joins the rooms of the user conversations and sets presence online', async () => {
      messaging.listConversationIdsForUser.mockResolvedValue(['c1', 'c2']);
      const socket = makeSocket({ data: { userId: 'u1' } });
      await gateway.handleConnection(socket as never);
      expect(messaging.listConversationIdsForUser).toHaveBeenCalledWith('u1');
      expect(socket.join).toHaveBeenCalledWith('conv:c1');
      expect(socket.join).toHaveBeenCalledWith('conv:c2');
      expect(messaging.updatePresence).toHaveBeenCalledWith('u1', 'online');
      expect(server.emit).toHaveBeenCalledWith('presence:update', {
        userId: 'u1',
        status: 'online',
      });
    });
  });

  describe('handleDisconnect', () => {
    it('sets presence offline and broadcasts', async () => {
      const socket = makeSocket({ data: { userId: 'u1' } });
      await gateway.handleDisconnect(socket as never);
      expect(messaging.updatePresence).toHaveBeenCalledWith('u1', 'offline');
      expect(server.emit).toHaveBeenCalledWith('presence:update', {
        userId: 'u1',
        status: 'offline',
      });
    });
  });

  describe('onTyping', () => {
    it('forwards typing to the room for members only', async () => {
      messaging.isMember.mockResolvedValue(true);
      const client = makeSocket({ data: { userId: 'u1' } });
      await gateway.onTyping(client as never, {
        conversationId: 'c1',
        isTyping: true,
      });
      expect(client.to).toHaveBeenCalledWith('conv:c1');
      const emitMock = (client.to('conv:c1') as { emit: jest.Mock }).emit;
      expect(emitMock).toHaveBeenCalledWith('typing', {
        conversationId: 'c1',
        userId: 'u1',
        isTyping: true,
      });
    });

    it('ignores non-members', async () => {
      messaging.isMember.mockResolvedValue(false);
      const client = makeSocket({ data: { userId: 'u1' } });
      await gateway.onTyping(client as never, {
        conversationId: 'c1',
        isTyping: true,
      });
      expect(client.to).not.toHaveBeenCalled();
    });
  });

  describe('notify helpers', () => {
    it('notifyNewMessage emits to the conversation room', () => {
      gateway.notifyNewMessage('c1', { id: 'm1' });
      expect(server.to).toHaveBeenCalledWith('conv:c1');
      const emitMock = (server.to('conv:c1') as { emit: jest.Mock }).emit;
      expect(emitMock).toHaveBeenCalledWith('message:new', { id: 'm1' });
    });

    it('notifyPresence broadcasts to everyone', () => {
      gateway.notifyPresence({ userId: 'u1', status: 'away' });
      expect(server.emit).toHaveBeenCalledWith('presence:update', {
        userId: 'u1',
        status: 'away',
      });
    });

    it('notifyReceipt emits to the conversation room', () => {
      gateway.notifyReceipt('c1', { messageId: 'm1' });
      const emitMock = (server.to('conv:c1') as { emit: jest.Mock }).emit;
      expect(emitMock).toHaveBeenCalledWith('receipt:update', {
        messageId: 'm1',
      });
    });
  });
});
