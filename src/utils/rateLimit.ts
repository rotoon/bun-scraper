/**
 * Simple rate limiting implementation
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60;

export function rateLimit(identifier: string): {
  success: boolean;
  count: number;
  resetTime?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // New window or expired entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + WINDOW_MS,
      lastAccess: now,
    };
    rateLimitStore.set(identifier, newEntry);
    return { success: true, count: 1, resetTime: newEntry.resetTime };
  }

  // Existing entry within window
  if (entry.count >= MAX_REQUESTS) {
    return { success: false, count: entry.count, resetTime: entry.resetTime };
  }

  // Increment count
  entry.count++;
  entry.lastAccess = now;
  rateLimitStore.set(identifier, entry);

  return { success: true, count: entry.count, resetTime: entry.resetTime };
}

// Cleanup old entries periodically
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
); // Cleanup every 5 minutes
