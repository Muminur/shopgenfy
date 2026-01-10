import { describe, it, expect } from 'vitest';
import { getCacheHeaders, withCacheHeaders, CacheDuration } from '@/lib/cache';

describe('cache utilities', () => {
  describe('getCacheHeaders', () => {
    it('should return no-cache headers for no-store config', () => {
      const headers = getCacheHeaders({ type: 'no-store' });

      expect(headers['Cache-Control']).toBe('no-store, must-revalidate');
      expect(headers['Pragma']).toBe('no-cache');
      expect(headers['Expires']).toBe('0');
    });

    it('should return public cache headers with default duration', () => {
      const headers = getCacheHeaders({ type: 'public' });

      expect(headers['Cache-Control']).toContain('public');
      expect(headers['Cache-Control']).toContain('max-age=');
      expect(headers['Cache-Control']).toContain('s-maxage=');
    });

    it('should return public cache headers with custom duration', () => {
      const headers = getCacheHeaders({
        type: 'public',
        duration: CacheDuration.ONE_HOUR,
      });

      expect(headers['Cache-Control']).toBe(
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=60'
      );
    });

    it('should return private cache headers', () => {
      const headers = getCacheHeaders({
        type: 'private',
        duration: CacheDuration.FIVE_MINUTES,
      });

      expect(headers['Cache-Control']).toBe('private, max-age=300, must-revalidate');
    });

    it('should include stale-while-revalidate for public caching', () => {
      const headers = getCacheHeaders({
        type: 'public',
        duration: CacheDuration.FIVE_MINUTES,
        staleWhileRevalidate: 120,
      });

      expect(headers['Cache-Control']).toContain('stale-while-revalidate=120');
    });

    it('should include must-revalidate for must-revalidate config', () => {
      const headers = getCacheHeaders({
        type: 'public',
        duration: CacheDuration.FIVE_MINUTES,
        mustRevalidate: true,
      });

      expect(headers['Cache-Control']).toContain('must-revalidate');
    });
  });

  describe('withCacheHeaders', () => {
    it('should add cache headers to Response object', () => {
      const response = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
      });

      const cachedResponse = withCacheHeaders(response, { type: 'public' });

      expect(cachedResponse.headers.get('Cache-Control')).toContain('public');
    });

    it('should preserve existing headers', () => {
      const response = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
      });

      const cachedResponse = withCacheHeaders(response, { type: 'public' });

      expect(cachedResponse.headers.get('Content-Type')).toBe('application/json');
      expect(cachedResponse.headers.get('X-Custom-Header')).toBe('custom-value');
      expect(cachedResponse.headers.get('Cache-Control')).toContain('public');
    });

    it('should handle no-store caching', () => {
      const response = new Response(JSON.stringify({ data: 'test' }));

      const cachedResponse = withCacheHeaders(response, { type: 'no-store' });

      expect(cachedResponse.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
      expect(cachedResponse.headers.get('Pragma')).toBe('no-cache');
    });
  });

  describe('CacheDuration', () => {
    it('should have correct duration values', () => {
      expect(CacheDuration.FIVE_MINUTES).toBe(300);
      expect(CacheDuration.FIFTEEN_MINUTES).toBe(900);
      expect(CacheDuration.ONE_HOUR).toBe(3600);
      expect(CacheDuration.ONE_DAY).toBe(86400);
      expect(CacheDuration.ONE_WEEK).toBe(604800);
      expect(CacheDuration.ONE_YEAR).toBe(31536000);
    });
  });
});
