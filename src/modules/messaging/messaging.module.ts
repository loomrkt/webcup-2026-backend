import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// @purge:realtime-start
import { AuthModule } from '../auth/auth.module';
// @purge:realtime-end
import { User } from '../auth/entities/user.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message } from './entities/message.entity';
import { UserKey } from './entities/user-key.entity'; // @purge:e2ee-import
import { Presence } from './entities/presence.entity'; // @purge:presence-import
import { MessageReceipt } from './entities/message-receipt.entity'; // @purge:receipts-import
import { ConversationMemberKey } from './entities/conversation-member-key.entity'; // @purge:groups-import
import { BlockedUser } from './entities/blocked-user.entity'; // @purge:block-import
import { MessagingController } from './messaging.controller';
// @purge:realtime-start
import { MessagingGateway } from './messaging.gateway';
// @purge:realtime-end
import { MessagingService } from './messaging.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationMember,
      Message,
      // @purge:e2ee-start
      UserKey,
      // @purge:e2ee-end
      // @purge:presence-start
      Presence,
      // @purge:presence-end
      // @purge:receipts-start
      MessageReceipt,
      // @purge:receipts-end
      // @purge:groups-start
      ConversationMemberKey,
      // @purge:groups-end
      // @purge:block-start
      BlockedUser,
      // @purge:block-end
      User,
    ]),
    // @purge:realtime-start
    AuthModule,
    // @purge:realtime-end
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    // @purge:realtime-start
    MessagingGateway,
    // @purge:realtime-end
  ],
})
export class MessagingModule {}
