/**
 * Bounded in-process store for normalized image bytes, addressable by id.
 *
 * Every generated/uploaded image (icon or feature) is normalized to exact
 * Shopify specs (see `image-normalizer.ts`) and put here; routes then hand
 * out `/api/images/<id>` as a stable, same-origin URL instead of leaking
 * multi-MB base64 payloads or third-party `data:`/hotlink URLs into app
 * state. LRU + total-byte + TTL eviction keeps memory bounded.
 *
 * Uses the same dev-global singleton pattern as `src/lib/mongodb.ts` so the
 * store survives Next.js dev-server HMR (a fresh module instance on every
 * reload would otherwise 404 every previously-issued image URL).
 */

import { randomUUID } from 'crypto';

export type ImageKind = 'icon' | 'feature';
export type ImageProvider = 'pollinations' | 'gemini' | 'upload';

export interface StoredImage {
  id: string;
  url: string;
  width: number;
  height: number;
  type: ImageKind;
  altText: string;
  provider: ImageProvider;
  featureText?: string;
  submissionId?: string;
  createdAt: number;
}

export interface PutImageEntry {
  buffer: Buffer;
  width: number;
  height: number;
  type: ImageKind;
  altText: string;
  submissionId?: string;
  provider: ImageProvider;
  featureText?: string;
}

export interface StoredImageEntry {
  meta: StoredImage;
  buffer: Buffer;
}

export interface ImageStoreOptions {
  /** Maximum number of entries before LRU eviction kicks in. */
  maxEntries?: number;
  /** Maximum combined byte size of all stored buffers. */
  maxTotalBytes?: number;
  /** Milliseconds an entry may live before it is treated as expired. */
  ttlMs?: number;
  /** Injectable clock, purely for deterministic TTL tests. */
  clock?: () => number;
  /** Injectable id generator, purely for deterministic tests. */
  idGenerator?: () => string;
}

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * The store itself. Exported so tests can construct isolated instances with
 * overridden limits/clock; application code should use the `imageStore`
 * singleton below instead of instantiating this directly.
 */
export class ImageStore {
  private readonly entries = new Map<string, StoredImageEntry>();
  private totalBytes = 0;
  private readonly maxEntries: number;
  private readonly maxTotalBytes: number;
  private readonly ttlMs: number;
  private readonly clock: () => number;
  private readonly idGenerator: () => string;

  constructor(options: ImageStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.clock = options.clock ?? Date.now;
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  put(entry: PutImageEntry): StoredImage {
    this.evictExpired();

    const id = this.idGenerator();
    const meta: StoredImage = {
      id,
      url: `/api/images/${id}`,
      width: entry.width,
      height: entry.height,
      type: entry.type,
      altText: entry.altText,
      provider: entry.provider,
      featureText: entry.featureText,
      submissionId: entry.submissionId,
      createdAt: this.clock(),
    };

    this.entries.set(id, { meta, buffer: entry.buffer });
    this.totalBytes += entry.buffer.byteLength;
    this.evictOverCapacity();

    return meta;
  }

  get(id: string): StoredImageEntry | undefined {
    this.evictExpired();

    const found = this.entries.get(id);
    if (!found) return undefined;

    // Re-insert to move this entry to the "most recently used" end of the
    // map's iteration order (Map preserves insertion order).
    this.entries.delete(id);
    this.entries.set(id, found);

    return found;
  }

  list(submissionId?: string): StoredImage[] {
    this.evictExpired();

    const all = Array.from(this.entries.values(), (e) => e.meta);
    if (submissionId === undefined) return all;
    return all.filter((meta) => meta.submissionId === submissionId);
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  private evictExpired(): void {
    const now = this.clock();
    for (const [id, entry] of this.entries) {
      if (now - entry.meta.createdAt > this.ttlMs) {
        this.totalBytes -= entry.buffer.byteLength;
        this.entries.delete(id);
      }
    }
  }

  private evictOverCapacity(): void {
    while (
      this.entries.size > 0 &&
      (this.entries.size > this.maxEntries || this.totalBytes > this.maxTotalBytes)
    ) {
      const oldestId = this.entries.keys().next().value;
      if (oldestId === undefined) break;
      const oldest = this.entries.get(oldestId);
      if (oldest) this.totalBytes -= oldest.buffer.byteLength;
      this.entries.delete(oldestId);
    }
  }
}

declare global {
  var _imageStore: ImageStore | undefined;
}

let prodImageStore: ImageStore | undefined;

/**
 * Dev-global singleton getter — mirrors `getMongoClient()` in
 * `src/lib/mongodb.ts`. In dev, Next.js HMR re-evaluates this module on
 * every edit; stashing the instance on `global` keeps store contents (and
 * therefore previously issued `/api/images/<id>` URLs) alive across reloads.
 */
function getSingleton(): ImageStore {
  if (process.env.NODE_ENV === 'development') {
    if (!global._imageStore) {
      global._imageStore = new ImageStore();
    }
    return global._imageStore;
  }

  if (!prodImageStore) {
    prodImageStore = new ImageStore();
  }
  return prodImageStore;
}

/**
 * Process-wide image store. Routes and generation providers should use this
 * rather than constructing their own `ImageStore`.
 */
export const imageStore = {
  put(entry: PutImageEntry): StoredImage {
    return getSingleton().put(entry);
  },
  get(id: string): StoredImageEntry | undefined {
    return getSingleton().get(id);
  },
  list(submissionId?: string): StoredImage[] {
    return getSingleton().list(submissionId);
  },
  clear(): void {
    getSingleton().clear();
  },
};
