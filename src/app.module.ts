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
import { I18nModule } from './modules/i18n/i18n.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { GuidesModule } from './modules/guides/guides.module';
import { MobilityModule } from './modules/mobility/mobility.module';
import { AuditModule } from './modules/audit/audit.module';
import { SecurityModule } from './modules/security/security.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { PlacesModule } from './modules/places/places.module';
import { GlossaryModule } from './modules/glossary/glossary.module';

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
    I18nModule,
    CommunicationsModule,
    AccountsModule,
    GuidesModule,
    MobilityModule,
    AuditModule,
    SecurityModule,
    AppointmentsModule,
    PlacesModule,
    GlossaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
