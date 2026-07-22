import sharp from 'sharp';

/**
 * Image normalizer — the "auto truncate per Shopify guidelines" engine.
 *
 * Every image (AI-generated or a real user/repo/website screenshot) is coerced
 * to an exact Shopify App Store spec:
 *   - icon    -> 1200x1200 PNG
 *   - feature -> 1600x900  PNG
 *
 * Fit strategy:
 *   - When the source aspect ratio is within 15% of the target aspect ratio we
 *     cover-crop (fill the frame, trim overflow) so the actual UI stays visible.
 *   - Otherwise we contain-pad onto a solid neutral background (#f6f6f7) so the
 *     whole source stays visible without distortion.
 *
 * Output is always PNG. Throws {@link ImageNormalizeError} (code `TOO_LARGE`)
 * if the encoded output exceeds Shopify's 20 MB ceiling.
 */

export const SHOPIFY_NORMALIZE_SPECS = {
  icon: { width: 1200, height: 1200 },
  feature: { width: 1600, height: 900 },
} as const;

/** Neutral background used when padding a far-off-aspect source. */
export const NORMALIZE_BACKGROUND = { r: 246, g: 246, b: 247, alpha: 1 } as const;

/** Shopify hard ceiling for listing image file size. */
export const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

/** Cover-crop when the source aspect is within this fraction of the target. */
export const ASPECT_TOLERANCE = 0.15;

export type ImageKind = 'icon' | 'feature';

export type ImageNormalizeErrorCode = 'BAD_INPUT' | 'TOO_LARGE';

export class ImageNormalizeError extends Error {
  constructor(
    message: string,
    public readonly code: ImageNormalizeErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ImageNormalizeError';
  }
}

export interface NormalizedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'png';
  bytes: number;
}

/**
 * Normalize an arbitrary image buffer to the exact Shopify spec for `kind`.
 *
 * @param input Raw image bytes (PNG/JPEG/WebP/etc. — any sharp-decodable format).
 * @param kind  `'icon'` -> 1200x1200, `'feature'` -> 1600x900.
 */
export async function normalizeImage(input: Buffer, kind: ImageKind): Promise<NormalizedImage> {
  const target = SHOPIFY_NORMALIZE_SPECS[kind];

  // Read source dimensions to decide cover-crop vs contain-pad.
  let sourceWidth: number | undefined;
  let sourceHeight: number | undefined;
  try {
    const meta = await sharp(input).metadata();
    sourceWidth = meta.width;
    sourceHeight = meta.height;
  } catch (err) {
    throw new ImageNormalizeError('Input could not be decoded as an image', 'BAD_INPUT', err);
  }

  if (!sourceWidth || !sourceHeight) {
    throw new ImageNormalizeError('Input image has no readable dimensions', 'BAD_INPUT');
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = target.width / target.height;
  const withinTolerance = Math.abs(sourceAspect - targetAspect) <= ASPECT_TOLERANCE * targetAspect;

  let buffer: Buffer;
  try {
    const pipeline = sharp(input).resize(
      target.width,
      target.height,
      withinTolerance
        ? { fit: 'cover', position: 'centre' }
        : {
            fit: 'contain',
            background: { ...NORMALIZE_BACKGROUND },
          }
    );

    // Flatten any transparency onto the neutral background so padded corners are
    // an exact, opaque color and the PNG never carries stray alpha edges.
    buffer = await pipeline
      .flatten({ background: { ...NORMALIZE_BACKGROUND } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    if (err instanceof ImageNormalizeError) throw err;
    throw new ImageNormalizeError('Failed to normalize image', 'BAD_INPUT', err);
  }

  const bytes = buffer.byteLength;
  if (bytes > MAX_OUTPUT_BYTES) {
    throw new ImageNormalizeError(
      `Normalized image is ${bytes} bytes, exceeds ${MAX_OUTPUT_BYTES} byte limit`,
      'TOO_LARGE'
    );
  }

  return {
    buffer,
    width: target.width,
    height: target.height,
    format: 'png',
    bytes,
  };
}
