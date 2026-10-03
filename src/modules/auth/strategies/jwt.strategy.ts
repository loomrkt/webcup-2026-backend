import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { AuthService } from '../services/auth.service';

export const jwtPayload = (payload: unknown) => ({
  sub: (payload as { sub?: string }).sub ?? '',
  email: (payload as { email?: string }).email ?? '',
  type: (payload as { type?: string }).type ?? 'access',
  exp: (payload as { exp?: number }).exp ?? 0,
});

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      jsonWebTokenOptions: { algorithms: ['HS256'] },
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    } satisfies StrategyOptions);
  }

  async validate(payload: unknown) {
    const parsed = jwtPayload(payload);
    if (parsed.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.authService.getUserById(parsed.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { id: user.id, email: user.email };
  }
}
