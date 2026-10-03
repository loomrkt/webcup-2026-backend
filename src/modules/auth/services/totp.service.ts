import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';

@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  async generateQrDataUri(secret: string, email: string): Promise<string> {
    const issuer = 'nest-app';
    const uri = authenticator.keyuri(email, issuer, secret);
    return await toDataURL(uri, { width: 220, margin: 2 });
  }

  verify(secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    try {
      return authenticator.verify({ secret, token: code });
    } catch {
      return false;
    }
  }
}
