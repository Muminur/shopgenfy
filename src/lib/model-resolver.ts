/**
 * Dynamic Gemini model resolution with retirement-aware fallback.
 *
 * Google retires model IDs on a rolling basis (e.g. `gemini-2.0-flash` and
 * `gemini-2.5-flash` both return 404 "no longer available"). Hardcoding a
 * single model ID is the root cause of the app-wide outage this module fixes.
 *
 * Instead of pinning a model, callers resolve one at request time through a
 * verified fallback chain. When an upstream call reveals a model is retired,
 * it is marked dead in a short-lived in-process cache so the next resolution
 * skips it and self-heals onto a working model.
 *
 * Live-verified working models (2026-07-20): `gemini-flash-latest` (a
 * self-updating alias), `gemini-3.5-flash`, `gemini-3.1-flash-image`.
 */

/** How long a model stays flagged as dead before we retry it. */
const DEAD_MODEL_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Text-analysis fallback chain, most-preferred first. */
const TEXT_MODEL_FALLBACKS = ['gemini-flash-latest', 'gemini-3.5-flash'] as const;

/** Image-generation fallback chain, most-preferred first. */
const IMAGE_MODEL_FALLBACKS = ['gemini-3.1-flash-image', 'gemini-3-pro-image'] as const;

/** Sentinel meaning "let the resolver decide" (stored as a user's model choice). */
export const AUTO_MODEL = 'auto';

/** model id -> expiry timestamp (ms since epoch). */
const deadModels = new Map<string, number>();

/**
 * Flag a model as unavailable for {@link DEAD_MODEL_TTL_MS}. Idempotent; a
 * repeated call refreshes the TTL.
 */
export function markModelDead(model: string): void {
  if (!model) return;
  deadModels.set(model, Date.now() + DEAD_MODEL_TTL_MS);
}

/**
 * Whether a model is currently flagged dead. Entries past their TTL are
 * lazily evicted and reported as alive again.
 */
export function isModelDead(model: string): boolean {
  const expiry = deadModels.get(model);
  if (expiry === undefined) return false;
  if (Date.now() >= expiry) {
    deadModels.delete(model);
    return false;
  }
  return true;
}

/** Reset the dead-model cache. Intended for tests. */
export function clearDeadModelCache(): void {
  deadModels.clear();
}

/**
 * Return the first non-empty, non-dead candidate. If every candidate is dead
 * (or the list is empty) fall back to the supplied best-effort default so the
 * caller always receives a usable model id.
 */
function firstAlive(candidates: readonly string[], fallback: string): string {
  for (const candidate of candidates) {
    if (candidate && !isModelDead(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

/**
 * Resolve the text model to use for an analysis call.
 *
 * Order: `preferred` (unless `'auto'`) -> `GEMINI_TEXT_MODEL` env ->
 * `gemini-flash-latest` -> `gemini-3.5-flash`. Dead entries are skipped.
 */
export function resolveTextModel(preferred?: string): string {
  const candidates: string[] = [];
  if (preferred && preferred !== AUTO_MODEL) {
    candidates.push(preferred);
  }
  const envModel = process.env.GEMINI_TEXT_MODEL;
  if (envModel) {
    candidates.push(envModel);
  }
  candidates.push(...TEXT_MODEL_FALLBACKS);
  return firstAlive(candidates, TEXT_MODEL_FALLBACKS[TEXT_MODEL_FALLBACKS.length - 1]);
}

/**
 * Resolve the image-generation model.
 *
 * Order: `GEMINI_IMAGE_MODEL` env -> `gemini-3.1-flash-image` ->
 * `gemini-3-pro-image`. Dead entries are skipped.
 */
export function resolveImageModel(): string {
  const candidates: string[] = [];
  const envModel = process.env.GEMINI_IMAGE_MODEL;
  if (envModel) {
    candidates.push(envModel);
  }
  candidates.push(...IMAGE_MODEL_FALLBACKS);
  return firstAlive(candidates, IMAGE_MODEL_FALLBACKS[IMAGE_MODEL_FALLBACKS.length - 1]);
}

/**
 * True when an upstream response indicates the requested model has been
 * retired: a 404 whose body reports "no longer available" or a NOT_FOUND
 * model error. Used to trigger the mark-dead + retry-once flow.
 */
export function isModelRetiredError(status: number, body: string): boolean {
  if (status !== 404) return false;
  const text = (body || '').toLowerCase();
  return (
    text.includes('no longer available') ||
    text.includes('not_found') ||
    text.includes('is not found') ||
    (text.includes('model') && text.includes('not found'))
  );
}
