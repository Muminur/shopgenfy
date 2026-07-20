import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveTextModel,
  resolveImageModel,
  markModelDead,
  isModelDead,
  clearDeadModelCache,
  isModelRetiredError,
} from '@/lib/model-resolver';

describe('model-resolver', () => {
  beforeEach(() => {
    clearDeadModelCache();
    delete process.env.GEMINI_TEXT_MODEL;
    delete process.env.GEMINI_IMAGE_MODEL;
  });

  afterEach(() => {
    clearDeadModelCache();
    delete process.env.GEMINI_TEXT_MODEL;
    delete process.env.GEMINI_IMAGE_MODEL;
    vi.useRealTimers();
  });

  describe('resolveTextModel', () => {
    it('returns the preferred model when it is alive and not "auto"', () => {
      expect(resolveTextModel('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    });

    it('ignores the "auto" sentinel and returns the default fallback', () => {
      expect(resolveTextModel('auto')).toBe('gemini-flash-latest');
    });

    it('returns the default fallback when no preference is given', () => {
      expect(resolveTextModel()).toBe('gemini-flash-latest');
    });

    it('honors the GEMINI_TEXT_MODEL env override ahead of the fallback chain', () => {
      process.env.GEMINI_TEXT_MODEL = 'gemini-custom-model';
      expect(resolveTextModel('auto')).toBe('gemini-custom-model');
    });

    it('prefers an explicit request model over the env override', () => {
      process.env.GEMINI_TEXT_MODEL = 'gemini-custom-model';
      expect(resolveTextModel('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    });

    it('skips a dead preferred model and moves to the next live candidate', () => {
      markModelDead('gemini-flash-latest');
      // preferred/default is dead -> next in chain
      expect(resolveTextModel('auto')).toBe('gemini-3.5-flash');
    });

    it('skips a dead explicit preference and falls to the chain', () => {
      markModelDead('gemini-flash-latest');
      expect(resolveTextModel('gemini-flash-latest')).toBe('gemini-3.5-flash');
    });
  });

  describe('resolveImageModel', () => {
    it('returns the default image fallback', () => {
      expect(resolveImageModel()).toBe('gemini-3.1-flash-image');
    });

    it('honors the GEMINI_IMAGE_MODEL env override', () => {
      process.env.GEMINI_IMAGE_MODEL = 'gemini-custom-image';
      expect(resolveImageModel()).toBe('gemini-custom-image');
    });

    it('skips a dead image model', () => {
      markModelDead('gemini-3.1-flash-image');
      expect(resolveImageModel()).toBe('gemini-3-pro-image');
    });
  });

  describe('dead-model cache', () => {
    it('marks a model dead and reports it', () => {
      expect(isModelDead('gemini-flash-latest')).toBe(false);
      markModelDead('gemini-flash-latest');
      expect(isModelDead('gemini-flash-latest')).toBe(true);
    });

    it('clears the cache', () => {
      markModelDead('gemini-flash-latest');
      clearDeadModelCache();
      expect(isModelDead('gemini-flash-latest')).toBe(false);
    });

    it('expires a dead model after the 1 hour TTL', () => {
      vi.useFakeTimers();
      markModelDead('gemini-flash-latest');
      expect(isModelDead('gemini-flash-latest')).toBe(true);

      // Just before expiry it is still dead
      vi.advanceTimersByTime(59 * 60 * 1000);
      expect(isModelDead('gemini-flash-latest')).toBe(true);

      // After the TTL it recovers
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(isModelDead('gemini-flash-latest')).toBe(false);
      // and the resolver uses it again
      expect(resolveTextModel('auto')).toBe('gemini-flash-latest');
    });
  });

  describe('isModelRetiredError', () => {
    it('detects the real Google 404 "no longer available" body', () => {
      const body =
        'This model models/gemini-2.0-flash is no longer available. Please see https://ai.google.dev/gemini-api/docs/models for a list of currently available models.';
      expect(isModelRetiredError(404, body)).toBe(true);
    });

    it('detects a NOT_FOUND model error', () => {
      const body = JSON.stringify({
        error: {
          code: 404,
          status: 'NOT_FOUND',
          message: 'models/foo is not found for API version v1beta',
        },
      });
      expect(isModelRetiredError(404, body)).toBe(true);
    });

    it('returns false for non-404 statuses even with matching text', () => {
      expect(isModelRetiredError(429, 'model is no longer available')).toBe(false);
      expect(isModelRetiredError(500, 'NOT_FOUND')).toBe(false);
    });

    it('returns false for an unrelated 404 body', () => {
      expect(isModelRetiredError(404, 'The requested webpage was not there')).toBe(false);
    });
  });
});
