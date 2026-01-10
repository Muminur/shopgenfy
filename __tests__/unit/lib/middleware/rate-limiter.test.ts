import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createRateLimiter,
  RateLimitConfig,
  clearRateLimitStore,
} from '@/lib/middleware/rate-limiter';

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearRateLimitStore(); // Clear rate limit state between tests
  });

  describe('Sliding Window Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const config: RateLimitConfig = {
        requests: 5,
        windowMs: 60000, // 1 minute
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Make 5 requests - all should pass
      for (let i = 0; i < 5; i++) {
        const response = await rateLimiter(request);
        expect(response).toBeNull(); // null means allowed
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const config: RateLimitConfig = {
        requests: 3,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Make 3 requests - should pass
      for (let i = 0; i < 3; i++) {
        const response = await rateLimiter(request);
        expect(response).toBeNull();
      }

      // 4th request should be blocked
      const blockedResponse = await rateLimiter(request);
      expect(blockedResponse).not.toBeNull();
      expect(blockedResponse?.status).toBe(429);
    });

    it('should return 429 with proper error message', async () => {
      const config: RateLimitConfig = {
        requests: 1,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // First request passes
      await rateLimiter(request);

      // Second request blocked
      const response = await rateLimiter(request);
      expect(response?.status).toBe(429);

      const body = await response?.json();
      expect(body).toHaveProperty('error');
      expect(body?.error).toContain('Too many requests');
    });

    it('should include Retry-After header in 429 response', async () => {
      const config: RateLimitConfig = {
        requests: 1,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      await rateLimiter(request);
      const response = await rateLimiter(request);

      expect(response?.headers.get('Retry-After')).toBeTruthy();
      const retryAfter = parseInt(response?.headers.get('Retry-After') || '0');
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60); // Should be within window
    });

    it('should reset rate limit after time window passes', async () => {
      const config: RateLimitConfig = {
        requests: 2,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Use up the limit
      await rateLimiter(request);
      await rateLimiter(request);

      // Should be blocked
      let response = await rateLimiter(request);
      expect(response?.status).toBe(429);

      // Advance time past the window
      vi.advanceTimersByTime(61000);

      // Should be allowed again
      response = await rateLimiter(request);
      expect(response).toBeNull();
    });

    it('should track different IPs separately', async () => {
      const config: RateLimitConfig = {
        requests: 2,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);

      const request1 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });

      // IP1 uses limit
      await rateLimiter(request1);
      await rateLimiter(request1);

      // IP1 should be blocked
      let response = await rateLimiter(request1);
      expect(response?.status).toBe(429);

      // IP2 should still be allowed
      response = await rateLimiter(request2);
      expect(response).toBeNull();
    });

    it('should use x-forwarded-for header for IP identification', async () => {
      const config: RateLimitConfig = {
        requests: 1,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' }, // Proxy chain
      });

      const response = await rateLimiter(request);
      expect(response).toBeNull(); // Should extract first IP
    });

    it('should fallback to localhost if no IP header', async () => {
      const config: RateLimitConfig = {
        requests: 1,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test');

      const response = await rateLimiter(request);
      expect(response).toBeNull(); // Should use fallback IP
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should enforce minimum 1 request per window', () => {
      const config: RateLimitConfig = {
        requests: 0,
        windowMs: 60000,
      };

      expect(() => createRateLimiter(config)).toThrow('requests must be at least 1');
    });

    it('should enforce minimum 1000ms window', () => {
      const config: RateLimitConfig = {
        requests: 10,
        windowMs: 500,
      };

      expect(() => createRateLimiter(config)).toThrow('windowMs must be at least 1000');
    });

    it('should allow valid configurations', () => {
      const config: RateLimitConfig = {
        requests: 10,
        windowMs: 60000,
      };

      expect(() => createRateLimiter(config)).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired entries automatically', async () => {
      const config: RateLimitConfig = {
        requests: 5,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Make requests
      await rateLimiter(request);
      await rateLimiter(request);

      // Advance time to expire entries
      vi.advanceTimersByTime(61000);

      // New request should trigger cleanup
      const response = await rateLimiter(request);
      expect(response).toBeNull();

      // Old entries should be cleaned up (implementation detail - verify in integration)
    });

    it('should handle concurrent requests correctly', async () => {
      const config: RateLimitConfig = {
        requests: 10,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Simulate concurrent requests
      const promises = Array.from({ length: 10 }, () => rateLimiter(request));
      const results = await Promise.all(promises);

      // All should pass
      const blocked = results.filter((r) => r !== null);
      expect(blocked.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed headers gracefully', async () => {
      const config: RateLimitConfig = {
        requests: 5,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '!!invalid!!' },
      });

      // Should not throw, should use fallback
      const response = await rateLimiter(request);
      expect(response).toBeNull();
    });

    it('should handle missing request object gracefully', async () => {
      const config: RateLimitConfig = {
        requests: 5,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);

      // @ts-expect-error Testing error case
      await expect(rateLimiter(null)).rejects.toThrow();
    });
  });

  describe('Header Information', () => {
    it('should include rate limit headers in allowed responses', async () => {
      const config: RateLimitConfig = {
        requests: 5,
        windowMs: 60000,
        includeHeaders: true,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const response = await rateLimiter(request);
      expect(response).toBeNull(); // Allowed, but headers should be available via response modification
    });

    it('should include X-RateLimit-Limit header', async () => {
      const config: RateLimitConfig = {
        requests: 10,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Use up limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter(request);
      }

      const response = await rateLimiter(request);
      expect(response?.headers.get('X-RateLimit-Limit')).toBe('10');
    });

    it('should include X-RateLimit-Remaining header', async () => {
      const config: RateLimitConfig = {
        requests: 5,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Use up limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter(request);
      }

      const response = await rateLimiter(request);
      expect(response?.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should include X-RateLimit-Reset header', async () => {
      const config: RateLimitConfig = {
        requests: 1,
        windowMs: 60000,
      };

      const rateLimiter = createRateLimiter(config);
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      await rateLimiter(request);
      const response = await rateLimiter(request);

      const resetHeader = response?.headers.get('X-RateLimit-Reset');
      expect(resetHeader).toBeTruthy();
      expect(parseInt(resetHeader || '0')).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('Custom Key Generation', () => {
    it('should support custom key generation function', async () => {
      const config: RateLimitConfig = {
        requests: 2,
        windowMs: 60000,
        keyGenerator: (req: NextRequest) => {
          const userId = req.headers.get('x-user-id');
          return userId || 'anonymous';
        },
      };

      const rateLimiter = createRateLimiter(config);

      const request1 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-user-id': 'user-123' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-user-id': 'user-456' },
      });

      // User 123 uses limit
      await rateLimiter(request1);
      await rateLimiter(request1);

      // User 123 blocked
      let response = await rateLimiter(request1);
      expect(response?.status).toBe(429);

      // User 456 still allowed
      response = await rateLimiter(request2);
      expect(response).toBeNull();
    });
  });

  describe('Skip Function', () => {
    it('should skip rate limiting when skip function returns true', async () => {
      const config: RateLimitConfig = {
        requests: 1,
        windowMs: 60000,
        skip: (req: NextRequest) => {
          return req.headers.get('x-skip-limit') === 'true';
        },
      };

      const rateLimiter = createRateLimiter(config);

      const normalRequest = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const skipRequest = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-skip-limit': 'true',
        },
      });

      // Use up limit with normal request
      await rateLimiter(normalRequest);

      // Normal request blocked
      let response = await rateLimiter(normalRequest);
      expect(response?.status).toBe(429);

      // Skip request still allowed
      response = await rateLimiter(skipRequest);
      expect(response).toBeNull();
    });
  });
});
