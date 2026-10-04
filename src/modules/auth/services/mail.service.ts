import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const isPlaceholder =
      !host ||
      host === 'smtp.example.com' ||
      host.includes('your-') ||
      host.includes('change-me');
    if (host && !isPlaceholder) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: (this.config.get<number>('SMTP_PORT') ?? 587) === 465,
        auth: {
          user: this.config.getOrThrow<string>('SMTP_USER'),
          pass: this.config.getOrThrow<string>('SMTP_PASS'),
        },
      });
    } else {
      this.logger.warn('SMTP_HOST not set - mail sending disabled');
    }
  }

  private get from(): string {
    return this.config.get<string>('SMTP_FROM') ?? 'noreply@localhost';
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      throw new UnprocessableEntityException('Email service is not configured');
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
    this.logger.log(`mail sent to ${to} (${subject})`);
  }

  /**
   * Envoi en arrière-plan (fire-and-forget) : la requête HTTP répond sans
   * attendre le SMTP. Les erreurs sont loguées, jamais propagées.
   */
  sendMailInBackground(to: string, subject: string, text: string): void {
    void this.sendMail(to, subject, text).catch((error: unknown) => {
      this.logger.warn(
        `background mail failed to ${to} (${subject}) — ${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
  }
}
