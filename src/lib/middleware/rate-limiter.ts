import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the time window
   * Must be at least 1
   */
  requests: number;

  /**
   * Time window in milliseconds
   * Must be at least 1000ms (1 second)
   */
  windowMs: number;

  /**
   * Optional: Include rate limit headers in responses
   * Default: true
   */
  includeHeaders?: boolean;

  /**
   * Optional: Custom key generator function
   * Default: Uses IP address from x-forwarded-for header
   */
  keyGenerator?: (request: NextRequest) => string;

  /**
   * Optional: Function to skip rate limiting for certain requests
   * Return true to skip rate limiting for this request
   */
  skip?: (request: NextRequest) => boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  requests: number[];
}

/**
 * In-memory store for rate limit tracking
 * Key: IP address or custom key
 * Value: { count, resetTime, requests[] }
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries from the store
 * Removes entries where resetTime has passed
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Extract IP address from request headers
 * Uses x-forwarded-for header (from proxies/load balancers)
 * Falls back to localhost if no IP found
 */
function getIpAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs (proxy chain)
    // Use the first IP (client IP)
    const ip = forwarded.split(',')[0].trim();

    // Validate IP format (basic check)
    if (ip && /^[\d.:a-f]+$/i.test(ip)) {
      return ip;
    }
  }

  // Fallback to localhost
  return '127.0.0.1';
}

/**
 * Create a rate limiter middleware function
 * Uses sliding window algorithm for accurate rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  // Validate configuration
  if (config.requests < 1) {
    throw new Error('requests must be at least 1');
  }

  if (config.windowMs < 1000) {
    throw new Error('windowMs must be at least 1000');
  }

  const includeHeaders = config.includeHeaders !== false; // Default true

  /**
   * Rate limiter middleware function
   * Returns null if request is allowed
   * Returns NextResponse with 429 status if rate limit exceeded
   */
  return async function rateLimiter(request: NextRequest): Promise<NextResponse | null> {
    if (!request) {
      throw new Error('Request object is required');
    }

    // Check if request should skip rate limiting
    if (config.skip && config.skip(request)) {
      return null; // Allow request
    }

    // Get identifier for this client
    const key = config.keyGenerator ? config.keyGenerator(request) : getIpAddress(request);

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries periodically
    if (Math.random() < 0.1) {
      // 10% chance to clean up on each request
      cleanupExpiredEntries();
    }

    // Get or create entry for this key
    let entry = rateLimitStore.get(key);

    if (!entry) {
      // First request from this key
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        requests: [],
      };
      rateLimitStore.set(key, entry);
    }

    // Remove requests outside the current window (sliding window)
    entry.requests = entry.requests.filter((timestamp) => timestamp > windowStart);

    // Update count based on remaining requests
    entry.count = entry.requests.length;

    // Check if limit would be exceeded with this new request
    if (entry.count >= config.requests) {
      // Rate limit exceeded
      const oldestRequest = entry.requests[0] || now;
      const resetTime = oldestRequest + config.windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000); // seconds

      const response = NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter,
        },
        { status: 429 }
      );

      // Add headers
      response.headers.set('Retry-After', retryAfter.toString());

      if (includeHeaders) {
        response.headers.set('X-RateLimit-Limit', config.requests.toString());
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
      }

      return response;
    }

    // Add current request to the list
    entry.requests.push(now);
    entry.count = entry.requests.length;

    // Update reset time for the window
    const oldestRequest = entry.requests[0];
    entry.resetTime = oldestRequest + config.windowMs;

    // Request is allowed
    return null;
  };
}

/**
 * Predefined rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  gemini: {
    models: {
      requests: 30,
      windowMs: 60000, // 1 minute
    } as RateLimitConfig,
    analyze: {
      requests: 10,
      windowMs: 60000, // 1 minute
    } as RateLimitConfig,
  },
  nanobanana: {
    generate: {
      requests: 5,
      windowMs: 60000, // 1 minute (expensive operation)
    } as RateLimitConfig,
    status: {
      requests: 60,
      windowMs: 60000, // 1 minute (lightweight polling)
    } as RateLimitConfig,
    batch: {
      requests: 2,
      windowMs: 60000, // 1 minute (very expensive)
    } as RateLimitConfig,
  },
};

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
