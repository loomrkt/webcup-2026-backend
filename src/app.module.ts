import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './app-config.module';
import { typeOrmModule } from './database/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ServicesModule } from './modules/services/services.module';
import { NewsModule } from './modules/news/news.module';
import { ContactModule } from './modules/contact/contact.module';
import { RequestsModule } from './modules/requests/requests.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    AppConfigModule,
    typeOrmModule,
    AuthModule,
    MessagingModule,
    RbacModule,
    ServicesModule,
    NewsModule,
    ContactModule,
    RequestsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
