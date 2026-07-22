/**
 * Local-source extractor.
 *
 * Turns a user-supplied zip archive or a pasted README into the same
 * `PreparedContent` shape the URL and GitHub analysis paths consume, so local
 * source can feed the shared `analyzeContent` prompt/parse/truncate pipeline in
 * `gemini.ts`.
 *
 * Decompression-bomb guards run BEFORE any entry is decompressed: the archive
 * is rejected on compressed size, entry count, and declared (central-directory)
 * uncompressed sizes without inflating anything. Nothing is written to disk, so
 * zip-slip does not apply — the only in-memory threat is a decompression bomb,
 * which the guards address.
 *
 * Secret redaction is line-level: any line whose text looks like it assigns an
 * API key / secret / token / password / authorization value is replaced whole
 * with `[redacted]` before the text is handed to the model.
 */

import AdmZip from 'adm-zip';
import type { PreparedContent } from './gemini';

/** Reject the upload before parsing when the compressed archive exceeds this. */
const MAX_COMPRESSED_BYTES = 30 * 1024 * 1024;
/** Reject when the sum of declared uncompressed entry sizes exceeds this. */
const MAX_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
/** Reject when any single entry declares more than this uncompressed. */
const MAX_ENTRY_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
/** Reject when the archive holds more than this many entries. */
const MAX_ENTRIES = 2000;
/** Upper bound on the merged text handed to the model. */
const MAX_TEXT_LENGTH = 12000;
/** Cap on harvested screenshot candidates. */
const MAX_IMAGES = 10;
/** Skip individual image entries larger than this once decompressed. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** A harvested screenshot candidate carried as decoded bytes. */
export interface SourceScreenshot {
  base64: string;
  mimeType: string;
}

/** The result of extracting from a zip: prepared content plus screenshots. */
export type ExtractedSource = PreparedContent & { screenshots: SourceScreenshot[] };

/**
 * Raised when an archive is malformed or trips a decompression-bomb guard.
 * `code` is `'ZIP_BOMB'` for a guard failure and `'INVALID_ZIP'` for an archive
 * adm-zip cannot parse. The route maps both to a 400.
 */
export class SourceExtractError extends Error {
  constructor(
    message: string,
    public readonly code: 'ZIP_BOMB' | 'INVALID_ZIP'
  ) {
    super(message);
    this.name = 'SourceExtractError';
  }
}

const SECRET_LINE = /(api[_-]?key|secret|token|password|authorization)\s*[:=]/i;

/** Replace any line that appears to leak a credential with `[redacted]`. */
function redactSecrets(text: string): string {
  return text
    .split('\n')
    .map((line) => (SECRET_LINE.test(line) ? '[redacted]' : line))
    .join('\n');
}

/** Skip vendored / VCS / macOS-resource paths that never describe the app. */
function isExcludedPath(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('node_modules/') ||
    lower.includes('/node_modules/') ||
    lower.startsWith('.git/') ||
    lower.includes('/.git/') ||
    lower.startsWith('__macosx/') ||
    lower.includes('/__macosx/')
  );
}

/**
 * Classify a text entry by priority, or return null when it is not a wanted
 * text file. Lower numbers are assembled first: README, then docs markdown,
 * then package.json, then shopify.app.toml.
 */
function classifyText(name: string): number | null {
  const lower = name.toLowerCase();
  const base = lower.split('/').pop() || '';
  if (base.startsWith('readme')) return 0;
  if ((lower.startsWith('docs/') || lower.includes('/docs/')) && lower.endsWith('.md')) return 1;
  if (base === 'package.json') return 2;
  if (base === 'shopify.app.toml') return 3;
  return null;
}

/** Map a supported image extension to its MIME type, or null. */
function imageMimeType(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

/** Redact then hard-cap merged text at the model budget. */
function capText(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) : trimmed;
}

/**
 * Extract a `PreparedContent` (plus screenshot candidates) from a zip buffer.
 *
 * Guards run first and reject the archive without decompressing any entry.
 * Only README, docs markdown, package.json, and shopify.app.toml text is read
 * (with secrets redacted and total text capped), and up to 10 raster images
 * are harvested as screenshot candidates.
 */
export function extractFromZip(zip: Buffer): ExtractedSource {
  // Guard 1 — compressed size. Runs before any parsing so an oversized upload
  // can never reach the central-directory parser.
  if (zip.length > MAX_COMPRESSED_BYTES) {
    throw new SourceExtractError('Archive exceeds the 30 MB compressed size limit', 'ZIP_BOMB');
  }

  let archive: AdmZip;
  try {
    archive = new AdmZip(zip);
  } catch {
    throw new SourceExtractError('Could not read the upload as a zip archive', 'INVALID_ZIP');
  }

  // getEntries() reads the central directory only — it does not decompress.
  const entries = archive.getEntries();

  // Guard 2 — entry count.
  if (entries.length > MAX_ENTRIES) {
    throw new SourceExtractError('Archive contains too many entries', 'ZIP_BOMB');
  }

  // Guards 3 & 4 — per-entry and total declared uncompressed size, from the
  // central-directory headers (no decompression).
  let declaredTotal = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const size = entry.header.size;
    // A declared uncompressed size of 0 paired with a real compressed payload is
    // a decompression-bomb bypass: adm-zip's inflater only enforces its
    // maxOutputLength cap when the expected length is > 0, so a lying 0 lets
    // getData() inflate without bound (a legitimate empty file has BOTH size and
    // compressedSize at 0). Reject before any entry is decompressed.
    if (size === 0 && entry.header.compressedSize > 0) {
      throw new SourceExtractError(
        'Archive entry declares zero uncompressed size but carries compressed data',
        'ZIP_BOMB'
      );
    }
    if (size > MAX_ENTRY_UNCOMPRESSED_BYTES) {
      throw new SourceExtractError('Archive contains an oversized entry', 'ZIP_BOMB');
    }
    declaredTotal += size;
    if (declaredTotal > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new SourceExtractError(
        'Archive uncompressed size exceeds the 100 MB limit',
        'ZIP_BOMB'
      );
    }
  }

  // Extraction — every guard has passed.
  const textPieces: { priority: number; content: string }[] = [];
  const screenshots: SourceScreenshot[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    if (isExcludedPath(name)) continue;

    const priority = classifyText(name);
    if (priority !== null) {
      const content = redactSecrets(entry.getData().toString('utf-8'));
      textPieces.push({ priority, content });
      continue;
    }

    if (screenshots.length < MAX_IMAGES) {
      const mimeType = imageMimeType(name);
      if (mimeType) {
        const data = entry.getData();
        if (data.length > 0 && data.length <= MAX_IMAGE_BYTES) {
          screenshots.push({ base64: data.toString('base64'), mimeType });
        }
      }
    }
  }

  textPieces.sort((a, b) => a.priority - b.priority);
  const textContent = capText(textPieces.map((p) => p.content).join('\n\n'));

  return {
    title: '',
    description: '',
    textContent,
    // `images` is what the shared pipeline consumes (mapped to result
    // `screenshots`); `screenshots` is the same array under its named field so
    // callers/tests can read it directly.
    images: screenshots,
    screenshots,
    sourceLabel: 'Uploaded source archive',
  };
}

/**
 * Build `PreparedContent` from pasted README/description text. Applies the same
 * line-level secret redaction and text cap as the zip path; carries no
 * screenshots.
 */
export function extractFromText(readme: string): PreparedContent {
  const textContent = capText(redactSecrets(readme || ''));
  return {
    title: '',
    description: '',
    textContent,
    images: [],
    sourceLabel: 'Pasted source description',
  };
}
