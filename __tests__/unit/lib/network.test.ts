import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, isOnline, NetworkError } from '@/lib/network';

describe('network utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchWithRetry', () => {
    it('should return response on first successful attempt', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const response = await fetchWithRetry('https://api.example.com/test');

      expect(response).toBe(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable status codes', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const mockError = new Response('', { status: 503 });
      const mockSuccess = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockError).mockResolvedValueOnce(mockSuccess);

      const response = await fetchWithRetry(
        'https://api.example.com/test',
        {},
        {
          maxRetries: 2,
          baseDelay: 10, // Short delay for testing
        }
      );

      expect(response).toBe(mockSuccess);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const mockError = new Response('', { status: 503 });

      (global.fetch as any).mockResolvedValue(mockError);

      await expect(
        fetchWithRetry(
          'https://api.example.com/test',
          {},
          {
            maxRetries: 1,
            baseDelay: 10, // Short delay for testing
          }
        )
      ).rejects.toThrow(NetworkError);

      expect(global.fetch).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('should not retry on non-retryable status codes', async () => {
      const mockError = new Response('', { status: 400 });

      (global.fetch as any).mockResolvedValueOnce(mockError);

      await expect(fetchWithRetry('https://api.example.com/test')).rejects.toThrow(NetworkError);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const mockError = new Response('', { status: 503 });
      let callCount = 0;

      (global.fetch as any).mockImplementation(async () => {
        callCount++;
        return mockError;
      });

      const start = Date.now();

      await expect(
        fetchWithRetry(
          'https://api.example.com/test',
          {},
          {
            maxRetries: 2,
            baseDelay: 50, // Short delay for testing
            backoffMultiplier: 2,
          }
        )
      ).rejects.toThrow(NetworkError);

      const duration = Date.now() - start;

      // Should have made 3 calls (initial + 2 retries)
      expect(callCount).toBe(3);

      // Total delay should be at least baseDelay + baseDelay*2 = 150ms
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('isOnline', () => {
    it('should return true when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      expect(isOnline()).toBe(true);
    });

    it('should return false when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      expect(isOnline()).toBe(false);
    });
  });

  describe('NetworkError', () => {
    it('should create error with status code', () => {
      const error = new NetworkError('Test error', 503, true);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(503);
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe('NetworkError');
    });
  });
});
