const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Simple in-memory rate limit keyed by client IP (single Node process). */
export function checkDemoTokenRateLimit(clientIp: string): RateLimitResult {
  const key = clientIp || "unknown";
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = bucket.windowStart + WINDOW_MS - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** @internal test helper */
export function resetDemoRateLimitsForTests(): void {
  buckets.clear();
}
