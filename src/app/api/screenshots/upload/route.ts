import { NextRequest, NextResponse } from 'next/server';
import { normalizeImage, ImageNormalizeError } from '@/lib/image-normalizer';
import { imageStore } from '@/lib/image-store';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

export const maxDuration = 30;

// This route runs unauthenticated sharp (CPU/memory) work per request. A looser
// cap than the AI-generation routes keeps the 20-file sequential folder upload
// working while still bounding abuse.
const rateLimiter = createRateLimiter(rateLimitConfigs.screenshots.upload);

/**
 * Direct-use screenshot upload. A user-supplied image (folder mode, or a
 * screenshot harvested from an analyzed source) is normalized to the exact
 * Shopify spec (T4) and stored (T5) so it can be used as a listing image
 * WITHOUT any AI generation. This is the Shopify 4.4.4 primary path: real UI
 * screenshots, not prompt-only art.
 */

/** Reject uploads larger than this before decoding — Shopify listing ceiling headroom. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Only real raster screenshot formats. GIF/SVG/etc. are rejected up front. */
const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ACCEPTED_EXTENSION = /\.(png|jpe?g|webp)$/i;

const VALID_KINDS = ['icon', 'feature'] as const;
type Kind = (typeof VALID_KINDS)[number];

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Expected multipart/form-data with a "file" field' },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'A file is required in the "file" field' }, { status: 400 });
  }

  const kindField = form.get('kind');
  const kind = typeof kindField === 'string' ? kindField.trim() : '';
  if (!VALID_KINDS.includes(kind as Kind)) {
    return NextResponse.json(
      { error: 'kind is required and must be "icon" or "feature"' },
      { status: 400 }
    );
  }

  // Size guard (Blob.size reflects the uploaded byte length).
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Uploaded image exceeds the 10 MB limit', code: 'TOO_LARGE' },
      { status: 400 }
    );
  }

  // MIME allowlist — sharp would happily decode a GIF, so reject unsupported
  // types before normalizing. Fall back to the filename when the browser sends
  // no content type.
  const mime = (file.type || '').toLowerCase();
  const name = typeof file.name === 'string' ? file.name : '';
  const typeOk = mime ? ACCEPTED_MIME.includes(mime) : ACCEPTED_EXTENSION.test(name);
  if (!typeOk) {
    return NextResponse.json(
      { error: 'Unsupported image type. Use PNG, JPG, or WebP.' },
      { status: 400 }
    );
  }

  const submissionIdField = form.get('submissionId');
  const submissionId =
    typeof submissionIdField === 'string' && submissionIdField.trim()
      ? submissionIdField.trim()
      : undefined;

  const altField = form.get('altText');
  const altText =
    typeof altField === 'string' && altField.trim()
      ? altField.trim()
      : kind === 'icon'
        ? 'Uploaded app icon'
        : 'Uploaded screenshot';

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const normalized = await normalizeImage(buffer, kind as Kind);
    const stored = imageStore.put({
      buffer: normalized.buffer,
      width: normalized.width,
      height: normalized.height,
      type: kind as Kind,
      altText,
      provider: 'upload',
      submissionId,
    });

    return NextResponse.json({ image: stored });
  } catch (error) {
    if (error instanceof ImageNormalizeError) {
      // Bytes are user-supplied on this route, so a decode/size failure is bad
      // input (400), not an upstream fault.
      return NextResponse.json(
        { error: `Could not process image: ${error.message}`, code: error.code },
        { status: 400 }
      );
    }
    console.error('[/api/screenshots/upload] error:', error);
    return NextResponse.json({ error: 'Failed to process the uploaded image' }, { status: 500 });
  }
}
