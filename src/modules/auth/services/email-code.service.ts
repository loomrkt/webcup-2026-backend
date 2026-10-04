import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { IsNull, In, MoreThan, Repository } from 'typeorm';
import { BCRYPT_ROUNDS } from '../auth.constants';
import { EmailCode, EmailCodePurpose } from '../entities/email-code.entity';
import { MailService } from './mail.service';

@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);

  constructor(
    @InjectRepository(EmailCode)
    private readonly codes: Repository<EmailCode>,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /**
   * Génère un code à 6 chiffres, l'enregistre haché et renvoie la valeur
   * en clair (pour l'email ou le log de dev).
   */
  async generate(
    userId: string,
    purpose: EmailCodePurpose,
    ttlMinutes: number,
  ): Promise<string> {
    const code = String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(
      6,
      '0',
    );
    await this.codes.save(
      this.codes.create({
        userId,
        purpose,
        codeHash: await hash(code, BCRYPT_ROUNDS),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      }),
    );
    return code;
  }

  /** Vérifie un code non utilisé et non expiré ; le marque utilisé en cas de succès. */
  async verify(
    userId: string,
    purpose: EmailCodePurpose,
    code: string,
  ): Promise<boolean> {
    const candidates = await this.codes.find({
      where: {
        userId,
        purpose,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    for (const record of candidates) {
      if (await compare(code, record.codeHash)) {
        await this.codes.update({ id: record.id }, { usedAt: new Date() });
        return true;
      }
    }
    return false;
  }

  /** Invalide tous les codes encore actifs d'un utilisateur (après connexion réussie). */
  async invalidate(userId: string, purpose: EmailCodePurpose): Promise<void> {
    const active = await this.codes.find({
      where: { userId, purpose, usedAt: IsNull() },
    });
    if (active.length > 0) {
      await this.codes.update(
        { id: In(active.map((a) => a.id)) },
        { usedAt: new Date() },
      );
    }
  }

  /** Envoie le code par email (ou le log en dev) ; renvoie le code en clair. */
  async deliver(
    userId: string,
    email: string,
    purpose: EmailCodePurpose,
    ttlMinutes: number,
    subject: string,
  ): Promise<string> {
    const code = await this.generate(userId, purpose, ttlMinutes);
    const text = `Votre code est : ${code}\n\nIl expire dans ${ttlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
    if (this.mail.isConfigured) {
      this.mail.sendMailInBackground(email, subject, text);
    } else if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.warn(
        `Mail not configured — ${purpose} code for ${email}: ${code}`,
      );
    } else {
      throw new UnprocessableEntityException('Email service not configured');
    }
    return code;
  }
}
