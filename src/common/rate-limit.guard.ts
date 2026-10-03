import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** 429 — not exported by this @nestjs/common build; defined locally. */
export class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export interface ThrottleOptions {
  limit: number;
  windowSec: number;
}

export const THROTTLE_KEY = 'throttle';

/**
 * Per-route rate-limit definition, e.g.
 * `@Throttle({ limit: 20, windowSec: 900 })` = 20 requests / 15 min.
 */
export const Throttle = (opts: ThrottleOptions) =>
  SetMetadata(THROTTLE_KEY, opts);

const DEFAULT_OPTIONS: ThrottleOptions = { limit: 120, windowSec: 900 };

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter keyed by `ip|method|url` (single
 * instance). Throws 429 (TooManyRequestsException, wrapped by the global
 * exception filter into the standard envelope) with a `Retry-After` header
 * once the limit is exceeded. Apply with `@UseGuards(RateLimitGuard)` on a
 * controller (or route) and tune limits with `@Throttle({...})`.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const target = context.getClass();
    const opts = (Reflect.getMetadata(THROTTLE_KEY, handler) ??
      Reflect.getMetadata(THROTTLE_KEY, target) ??
      DEFAULT_OPTIONS) as ThrottleOptions;

    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const key = `${ip}|${req.method}|${req.originalUrl ?? req.url}`;

    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowSec * 1000 };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > opts.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      const res = context.switchToHttp().getResponse<Response>();
      res.setHeader('Retry-After', String(retryAfter));
      throw new TooManyRequestsException(
        `Too many requests — retry in ${retryAfter}s`,
      );
    }

    if (this.buckets.size > 10_000) this.sweep(now);
    return true;
  }

  private sweep(now: number): void {
    for (const [k, b] of this.buckets) {
      if (now >= b.resetAt) this.buckets.delete(k);
    }
  }
}
