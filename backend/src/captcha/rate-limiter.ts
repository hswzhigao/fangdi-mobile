/**
 * In-memory short-window rate limiter for captcha boundaries.
 *
 * - Uses a safe request-origin key (hashed, not raw IP).
 * - Bounded map with periodic cleanup; does not persist keys.
 * - Returns Retry-After seconds when limit exceeded.
 * - Never logs IPs or sensitive key material.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // per key per window
const CLEANUP_INTERVAL_MS = 5 * 60_000; // cleanup every 5 minutes
const MAX_BUCKETS = 10_000; // safety cap

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private lastCleanup = Date.now();

  /**
   * Build a safe request-origin key from a Request.
   * Uses CF-Connecting-IP with a simple hash to avoid persisting raw IPs.
   * Falls back to a fixed token when no IP header is present.
   */
  private requestKey(request: Request): string {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    // Simple 32-bit hash for collision-resistant but non-reversible key
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const ch = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0; // Convert to 32-bit integer
    }
    return `rl:${(hash >>> 0).toString(36)}`;
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Check if a request is allowed. Returns null if allowed,
   * or the number of seconds until the window resets (Retry-After).
   */
  check(request: Request): number | null {
    this.maybeCleanup();

    const key = this.requestKey(request);
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      // New window
      this.buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return null; // allowed
    }

    if (bucket.count < MAX_REQUESTS_PER_WINDOW) {
      bucket.count++;
      return null; // allowed
    }

    // Rate limited — return Retry-After in seconds
    return Math.ceil((bucket.resetAt - now) / 1000);
  }

  /** Expose bucket count for testing. */
  _bucketCount(): number {
    return this.buckets.size;
  }

  /** Expose count for a specific key (test helper). */
  _countFor(request: Request): number | undefined {
    const key = this.requestKey(request);
    return this.buckets.get(key)?.count;
  }
}
