import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logError, initErrorLogging } from '@/lib/error-logger';

describe('error-logger', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };

      logError(error, context, 'medium');

      expect(console.error).toHaveBeenCalled();
    });

    it('should include stack trace', () => {
      const error = new Error('Test error');

      logError(error);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('⚠️'),
        'Test error',
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it('should use correct emoji for severity levels', () => {
      const error = new Error('Test');

      logError(error, {}, 'low');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️'),
        expect.any(String),
        expect.any(Object)
      );

      logError(error, {}, 'high');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.any(String),
        expect.any(Object)
      );

      logError(error, {}, 'critical');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('🚨'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should add timestamp to context', () => {
      const error = new Error('Test error');
      const now = Date.now();

      vi.spyOn(Date, 'now').mockReturnValue(now);

      logError(error);

      expect(console.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({
            timestamp: now,
          }),
        })
      );
    });
  });

  describe('initErrorLogging', () => {
    it('should set up global error handlers', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      initErrorLogging();

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
  });
});
