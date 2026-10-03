import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './app-config.module';
import { typeOrmModule } from './database/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { RbacModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    AppConfigModule,
    typeOrmModule,
    AuthModule,
    MessagingModule,
    RbacModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
