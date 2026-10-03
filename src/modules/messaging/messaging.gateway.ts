import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/services/token.service';
import { MessagingService } from './messaging.service';

/**
 * Real-time layer (Socket.IO, namespace /messaging).
 *
 * Auth: the JWT is validated at handshake (Authorization header or
 * `auth.token`); the connection is rejected otherwise.
 *
 * Rooms: on connect the user joins the rooms of its conversations **from the
 * database** (never from client input) — a non-member can never listen to a
 * conversation's events.
 *
 * Events: `message:new`, `receipt:update` (pushed after the REST mutations),
 * `presence:update` (broadcast on connect/disconnect/PATCH), `typing`
 * (client → room).
 */
@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: true, credentials: true },
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messaging: MessagingService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  private static room(conversationId: string): string {
    return `conv:${conversationId}`;
  }

  private static socketUserId(socket: Socket): string | null {
    const data = socket.data as { userId?: string };
    return data.userId ?? null;
  }

  private emitToRoom(
    conversationId: string,
    event: string,
    payload: unknown,
  ): void {
    const srv = this.server as unknown as {
      to: (room: string) => { emit: (e: string, p: unknown) => void };
    };
    srv.to(MessagingGateway.room(conversationId)).emit(event, payload);
  }

  // @purge:presence-start
  private get presenceEnabled(): boolean {
    return (
      (
        this.config.get<string>('MESSAGING_PRESENCE') ?? 'true'
      ).toLowerCase() === 'true'
    );
  }
  // @purge:presence-end

  afterInit(server: Server): void {
    server.use((socket: Socket, next: (err?: Error) => void) => {
      try {
        const header = socket.handshake.headers.authorization ?? '';
        const token =
          header.replace(/^Bearer\s+/i, '') ||
          (socket.handshake.auth?.token as string | undefined) ||
          '';
        if (!token) {
          next(new Error('unauthorized'));
          return;
        }
        const payload = this.tokens.verifyAccessToken(token);
        const data = socket.data as { userId?: string };
        data.userId = payload.sub;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const userId = MessagingGateway.socketUserId(socket);
    if (!userId) return;
    try {
      const ids = await this.messaging.listConversationIdsForUser(userId);
      for (const id of ids) {
        await socket.join(MessagingGateway.room(id));
      }
      // @purge:presence-start
      if (this.presenceEnabled) {
        const presence = await this.messaging.updatePresence(userId, 'online');
        this.server.emit('presence:update', presence);
      }
      // @purge:presence-end
    } catch (e) {
      this.logger.warn(
        `handleConnection failed for ${userId}: ${(e as Error).message}`,
      );
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = MessagingGateway.socketUserId(socket);
    if (!userId) return;
    // @purge:presence-start
    if (this.presenceEnabled) {
      const presence = await this.messaging.updatePresence(userId, 'offline');
      this.server.emit('presence:update', presence);
    }
    // @purge:presence-end
  }

  // @purge:typing-start
  @SubscribeMessage('typing')
  async onTyping(
    client: Socket,
    payload: { conversationId: string; isTyping: boolean },
  ): Promise<void> {
    const userId = MessagingGateway.socketUserId(client);
    if (!userId) return;
    if (!payload?.conversationId || typeof payload.isTyping !== 'boolean') {
      return;
    }
    if (!(await this.messaging.isMember(userId, payload.conversationId))) {
      return;
    }
    const socket = client as unknown as {
      to: (room: string) => { emit: (e: string, p: unknown) => void };
    };
    socket.to(MessagingGateway.room(payload.conversationId)).emit('typing', {
      conversationId: payload.conversationId,
      userId,
      isTyping: payload.isTyping,
    });
  }
  // @purge:typing-end

  notifyNewMessage(conversationId: string, message: unknown): void {
    this.emitToRoom(conversationId, 'message:new', message);
  }

  notifyMessageEdited(conversationId: string, message: unknown): void {
    this.emitToRoom(conversationId, 'message:edited', message);
  }

  notifyMessageDeleted(conversationId: string, messageId: string): void {
    this.emitToRoom(conversationId, 'message:deleted', {
      conversationId,
      messageId,
    });
  }

  // @purge:receipts-start
  notifyReceipt(conversationId: string, receipt: unknown): void {
    this.emitToRoom(conversationId, 'receipt:update', receipt);
  }
  // @purge:receipts-end

  // @purge:presence-start
  notifyPresence(presence: unknown): void {
    this.server.emit('presence:update', presence);
  }
  // @purge:presence-end
}
