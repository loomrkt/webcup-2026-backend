import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { hashToken } from '../utils/token.util';

type Duration = `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

function asDuration(value: string): Duration {
  return value as Duration;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface Pending2faPayload {
  sub: string;
  email: string;
  type: '2fa';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  private get accessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private get refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  signAccessToken(userId: string, email: string): string {
    const payload: AccessTokenPayload = { sub: userId, email, type: 'access' };
    return sign(payload, this.accessSecret, {
      expiresIn: asDuration(
        this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
      ),
    });
  }

  signPending2faToken(userId: string, email: string): string {
    const payload: Pending2faPayload = { sub: userId, email, type: '2fa' };
    return sign(payload, this.accessSecret, { expiresIn: '5m' });
  }

  signRefreshToken(userId: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      type: 'refresh',
      jti: randomBytes(16).toString('hex'),
    };
    return sign(payload, this.refreshSecret, {
      expiresIn: asDuration(
        this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
      ),
    });
  }

  async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        token: hashToken(refreshToken),
        userId: user.id,
        expiresAt: this.refreshExpiry(),
      }),
    );
    return { accessToken, refreshToken };
  }

  private refreshExpiry(): Date {
    const exp = this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d';
    const match = exp.match(/(\d+)/);
    const days = match ? Number(match[1]) : 7;
    return new Date(Date.now() + days * 24 * 3600_000);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = verify(token, this.accessSecret, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;
      if (decoded.type !== 'access') throw new Error('wrong type');
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  verifyPending2faToken(token: string): Pending2faPayload {
    try {
      const decoded = verify(token, this.accessSecret, {
        algorithms: ['HS256'],
      }) as Pending2faPayload;
      if (decoded.type !== '2fa') throw new Error('wrong type');
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid or expired pending token');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = verify(token, this.refreshSecret, {
        algorithms: ['HS256'],
      }) as RefreshTokenPayload;
      if (decoded.type !== 'refresh') throw new Error('wrong type');
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
