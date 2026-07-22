/**
 * Client-side API helpers. Safe to import from client components — no
 * server-only modules, no Node built-ins. Every call carries the anonymous
 * `x-user-id` identity so the (now upsert-based) API can attribute work to a
 * user without a real auth system.
 */

const USER_ID_KEY = 'shopgenfy_user_id';
const SUBMISSION_ID_KEY = 'shopgenfy_submission_id';

/**
 * Return the persistent anonymous user id, creating and storing a
 * `user-<uuid>` on first use. Falls back to a stable placeholder when
 * localStorage/crypto are unavailable (SSR, locked-down environments).
 */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'demo-user';

  try {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = `user-${crypto.randomUUID()}`;
      localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  } catch {
    return 'demo-user';
  }
}

/**
 * `fetch` wrapper that attaches the `x-user-id` header (unless the caller has
 * already set one) while preserving all other request options.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('x-user-id')) {
    headers.set('x-user-id', getOrCreateUserId());
  }
  return fetch(input, { ...init, headers });
}

export const SUBMISSION_ID_STORAGE_KEY = SUBMISSION_ID_KEY;

export interface SaveDraftResult {
  id: string;
  created: boolean;
}

async function extractError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error || `Request failed (${response.status})`;
}

/**
 * Upsert a submission draft. With no current id it POSTs a new document and
 * returns the created id; with a current id it PUTs the existing one. If the
 * PUT target is gone (404 — e.g. a stale localStorage id), it falls back to a
 * POST. This is what stops auto-save from creating a new document every cycle.
 */
export async function saveDraft(
  payload: unknown,
  currentId: string | null
): Promise<SaveDraftResult> {
  const body = JSON.stringify(payload);

  if (currentId) {
    const putRes = await apiFetch(`/api/submissions/${currentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (putRes.ok) {
      return { id: currentId, created: false };
    }

    // Only a missing target is recoverable via re-create; surface anything else.
    if (putRes.status !== 404) {
      throw new Error(await extractError(putRes));
    }
  }

  const postRes = await apiFetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!postRes.ok) {
    throw new Error(await extractError(postRes));
  }

  const data = (await postRes.json().catch(() => ({}))) as { _id?: string; id?: string };
  const id = data._id ?? data.id ?? '';
  return { id, created: true };
}
