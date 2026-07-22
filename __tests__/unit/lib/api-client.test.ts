import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, getOrCreateUserId, saveDraft } from '@/lib/api-client';

// This jsdom build ships a non-functional `localStorage`, so install a real
// in-memory Storage for the identity-persistence assertions.
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('api-client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getOrCreateUserId', () => {
    it('returns the existing id already stored in localStorage', () => {
      localStorage.setItem('shopgenfy_user_id', 'user-fixed');
      expect(getOrCreateUserId()).toBe('user-fixed');
    });

    it('creates and persists a user-<uuid> id when none is stored', () => {
      const uuidSpy = vi
        .spyOn(globalThis.crypto, 'randomUUID')
        .mockReturnValue('11111111-1111-1111-1111-111111111111');

      const id = getOrCreateUserId();

      expect(id).toBe('user-11111111-1111-1111-1111-111111111111');
      expect(localStorage.getItem('shopgenfy_user_id')).toBe(id);
      // A second call returns the persisted value, not a fresh uuid.
      expect(getOrCreateUserId()).toBe(id);

      uuidSpy.mockRestore();
    });
  });

  describe('apiFetch', () => {
    it('attaches the x-user-id header from the stored identity', async () => {
      localStorage.setItem('shopgenfy_user_id', 'user-fixed');
      fetchMock.mockResolvedValue({ ok: true });

      await apiFetch('/api/settings');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/settings');
      const headers = new Headers(init.headers);
      expect(headers.get('x-user-id')).toBe('user-fixed');
    });

    it('preserves caller headers and an explicit x-user-id override', async () => {
      localStorage.setItem('shopgenfy_user_id', 'user-fixed');
      fetchMock.mockResolvedValue({ ok: true });

      await apiFetch('/api/settings', {
        headers: { 'x-user-id': 'user-explicit', 'Content-Type': 'application/json' },
      });

      const [, init] = fetchMock.mock.calls[0];
      const headers = new Headers(init.headers);
      expect(headers.get('x-user-id')).toBe('user-explicit');
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('forwards method and body unchanged', async () => {
      localStorage.setItem('shopgenfy_user_id', 'user-fixed');
      fetchMock.mockResolvedValue({ ok: true });

      await apiFetch('/api/submissions', { method: 'POST', body: '{"a":1}' });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(init.body).toBe('{"a":1}');
    });
  });

  describe('saveDraft', () => {
    beforeEach(() => {
      localStorage.setItem('shopgenfy_user_id', 'user-fixed');
    });

    it('POSTs to /api/submissions when there is no current id', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ _id: 'sub-1' }) });

      const result = await saveDraft({ appName: 'X' }, null);

      expect(result).toEqual({ id: 'sub-1', created: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/submissions');
      expect(init.method).toBe('POST');
    });

    it('PUTs to /api/submissions/[id] when a current id exists and never POSTs', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ _id: 'sub-1' }) });

      const result = await saveDraft({ appName: 'X' }, 'sub-1');

      expect(result).toEqual({ id: 'sub-1', created: false });
      const posts = fetchMock.mock.calls.filter((c) => c[0] === '/api/submissions');
      expect(posts.length).toBe(0);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/submissions/sub-1');
      expect(init.method).toBe('PUT');
    });

    it('falls back to POST when the PUT target is gone (404)', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Submission not found' }),
        })
        .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ _id: 'sub-2' }) });

      const result = await saveDraft({ appName: 'X' }, 'stale-id');

      expect(result).toEqual({ id: 'sub-2', created: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe('/api/submissions/stale-id');
      expect(fetchMock.mock.calls[1][0]).toBe('/api/submissions');
    });

    it('throws on a non-404 error response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Validation failed' }),
      });

      await expect(saveDraft({ appName: '' }, null)).rejects.toThrow(/Validation failed/);
    });

    it('performs exactly one POST across a create-then-update cycle (no duplicates)', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/submissions') {
          return Promise.resolve({ ok: true, status: 201, json: async () => ({ _id: 'sub-9' }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ _id: 'sub-9' }) });
      });

      const first = await saveDraft({ appName: 'A' }, null);
      const second = await saveDraft({ appName: 'AB' }, first.id);
      const third = await saveDraft({ appName: 'ABC' }, second.id);

      const posts = fetchMock.mock.calls.filter((c) => c[0] === '/api/submissions');
      expect(posts.length).toBe(1);
      expect(second.created).toBe(false);
      expect(third.created).toBe(false);
    });
  });
});
