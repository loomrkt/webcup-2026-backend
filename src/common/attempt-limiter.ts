/**
 * Sliding-window attempt limiter (in-memory, single-instance).
 *
 * Counts failures per key (email, user id, ...) within a window and locks the
 * key once `maxFails` is reached. Used to protect login / 2FA verification
 * against brute force at the account level (the RateLimitGuard protects at
 * the IP level).
 */
export interface AttemptState {
  fails: number;
  lockedUntil: number;
  windowStart: number;
}

export class AttemptLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly maxFails = 5,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  /** true when the key is currently locked. Expired locks are cleared. */
  isLocked(key: string, now = Date.now()): boolean {
    const s = this.attempts.get(key);
    if (!s) return false;
    if (now < s.lockedUntil) return true;
    if (s.lockedUntil > 0 && now >= s.lockedUntil) {
      this.attempts.delete(key);
    }
    return false;
  }

  /** seconds remaining before the lock expires (0 = not locked). */
  retryAfterSec(key: string, now = Date.now()): number {
    const s = this.attempts.get(key);
    if (!s || s.lockedUntil <= 0) return 0;
    return Math.max(0, Math.ceil((s.lockedUntil - now) / 1000));
  }

  /** record a failure; returns true when this failure triggered a lock. */
  recordFailure(key: string, now = Date.now()): boolean {
    const s = this.attempts.get(key) ?? {
      fails: 0,
      lockedUntil: 0,
      windowStart: now,
    };
    if (now >= s.windowStart + this.windowMs) {
      s.fails = 0;
      s.windowStart = now;
    }
    s.fails += 1;
    if (s.fails >= this.maxFails) {
      s.lockedUntil = now + this.windowMs;
    }
    this.attempts.set(key, s);
    if (this.attempts.size > 5000) this.prune(now);
    return s.fails >= this.maxFails;
  }

  /** clear a key on success. */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** remove expired entries so the map stays bounded. */
  prune(now = Date.now()): void {
    for (const [k, s] of this.attempts) {
      if (now >= s.lockedUntil && now >= s.windowStart + this.windowMs) {
        this.attempts.delete(k);
      }
    }
  }
}
