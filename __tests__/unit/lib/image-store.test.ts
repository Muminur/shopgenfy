import { describe, it, expect, beforeEach } from 'vitest';
import { ImageStore, imageStore } from '@/lib/image-store';

function buf(size: number, fill = 1): Buffer {
  return Buffer.alloc(size, fill);
}

describe('image-store', () => {
  describe('ImageStore (isolated instances)', () => {
    it('put/get roundtrip returns the same bytes and matching metadata', () => {
      const store = new ImageStore();
      const bytes = buf(10);
      const meta = store.put({
        buffer: bytes,
        width: 1200,
        height: 1200,
        type: 'icon',
        altText: 'App icon',
        provider: 'upload',
      });

      expect(meta.id).toBeTruthy();
      expect(meta.url).toBe(`/api/images/${meta.id}`);
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(1200);
      expect(meta.type).toBe('icon');
      expect(meta.altText).toBe('App icon');
      expect(meta.provider).toBe('upload');
      expect(typeof meta.createdAt).toBe('number');

      const found = store.get(meta.id);
      expect(found).toBeDefined();
      expect(found!.buffer.equals(bytes)).toBe(true);
      expect(found!.meta).toEqual(meta);
    });

    it('returns undefined for an unknown id', () => {
      const store = new ImageStore();
      expect(store.get('does-not-exist')).toBeUndefined();
    });

    it('carries optional submissionId and featureText through', () => {
      const store = new ImageStore();
      const meta = store.put({
        buffer: buf(1),
        width: 1600,
        height: 900,
        type: 'feature',
        altText: 'Feature image',
        provider: 'gemini',
        submissionId: 'sub-123',
        featureText: 'Real-time sync',
      });

      expect(meta.submissionId).toBe('sub-123');
      expect(meta.featureText).toBe('Real-time sync');
    });

    it('evicts the least-recently-used entry once the entry cap is exceeded', () => {
      let counter = 0;
      const store = new ImageStore({ maxEntries: 2, idGenerator: () => `id-${counter++}` });
      const a = store.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'a',
        provider: 'upload',
      });
      const b = store.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'b',
        provider: 'upload',
      });

      // Touch `a` so it becomes most-recently-used; `b` becomes the LRU victim.
      store.get(a.id);

      const c = store.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'c',
        provider: 'upload',
      });

      expect(store.get(a.id)).toBeDefined();
      expect(store.get(b.id)).toBeUndefined();
      expect(store.get(c.id)).toBeDefined();
    });

    it('evicts oldest entries once the total byte cap is exceeded', () => {
      let counter = 0;
      const store = new ImageStore({ maxTotalBytes: 15, idGenerator: () => `id-${counter++}` });
      const a = store.put({
        buffer: buf(10),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'a',
        provider: 'upload',
      });
      const b = store.put({
        buffer: buf(10),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'b',
        provider: 'upload',
      });

      expect(store.get(a.id)).toBeUndefined();
      expect(store.get(b.id)).toBeDefined();
    });

    it('expires entries once the TTL elapses, using an injected clock', () => {
      let now = 0;
      const store = new ImageStore({ ttlMs: 1000, clock: () => now });
      const a = store.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'a',
        provider: 'upload',
      });

      now = 500;
      expect(store.get(a.id)).toBeDefined();

      now = 1500;
      expect(store.get(a.id)).toBeUndefined();
    });

    it('lists images filtered by submissionId, and all images when omitted', () => {
      const store = new ImageStore();
      const a = store.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'a',
        provider: 'upload',
        submissionId: 'sub-1',
      });
      const b = store.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'feature',
        altText: 'b',
        provider: 'upload',
        submissionId: 'sub-2',
      });

      expect(store.list('sub-1').map((m) => m.id)).toEqual([a.id]);
      expect(store.list('sub-2').map((m) => m.id)).toEqual([b.id]);
      expect(
        store
          .list()
          .map((m) => m.id)
          .sort()
      ).toEqual([a.id, b.id].sort());
    });

    it('clear empties the store', () => {
      const store = new ImageStore();
      store.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'a',
        provider: 'upload',
      });
      store.clear();
      expect(store.list()).toEqual([]);
    });
  });

  describe('imageStore (module singleton)', () => {
    beforeEach(() => {
      imageStore.clear();
    });

    it('persists puts across separate calls (module-level singleton)', () => {
      const meta = imageStore.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'singleton',
        provider: 'upload',
      });

      const found = imageStore.get(meta.id);
      expect(found).toBeDefined();
      expect(found!.meta.altText).toBe('singleton');
    });

    it('lists what was put on the singleton', () => {
      imageStore.put({
        buffer: buf(1),
        width: 1,
        height: 1,
        type: 'icon',
        altText: 'a',
        provider: 'upload',
        submissionId: 'sub-x',
      });

      expect(imageStore.list('sub-x')).toHaveLength(1);
    });
  });
});
