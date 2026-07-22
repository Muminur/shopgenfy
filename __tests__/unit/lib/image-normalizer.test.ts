import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  normalizeImage,
  ImageNormalizeError,
  SHOPIFY_NORMALIZE_SPECS,
} from '@/lib/image-normalizer';

/**
 * Fabricate a solid-color image buffer at exact dimensions using sharp itself.
 * Defaults to opaque RGB (3 channels) so padding tests are deterministic.
 */
async function solidImage(
  width: number,
  height: number,
  color: { r: number; g: number; b: number } = { r: 10, g: 120, b: 200 },
  format: 'png' | 'jpeg' = 'png'
): Promise<Buffer> {
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  });
  pipeline = format === 'jpeg' ? pipeline.jpeg() : pipeline.png();
  return pipeline.toBuffer();
}

describe('image-normalizer', () => {
  describe('SHOPIFY_NORMALIZE_SPECS', () => {
    it('declares exact icon and feature target dimensions', () => {
      expect(SHOPIFY_NORMALIZE_SPECS.icon.width).toBe(1200);
      expect(SHOPIFY_NORMALIZE_SPECS.icon.height).toBe(1200);
      expect(SHOPIFY_NORMALIZE_SPECS.feature.width).toBe(1600);
      expect(SHOPIFY_NORMALIZE_SPECS.feature.height).toBe(900);
    });
  });

  describe('normalizeImage - icon', () => {
    it('normalizes a 1024x1024 square to exactly 1200x1200 PNG', async () => {
      const input = await solidImage(1024, 1024);
      const result = await normalizeImage(input, 'icon');

      expect(result.format).toBe('png');
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
      expect(result.bytes).toBe(result.buffer.byteLength);

      // Re-read the produced buffer to prove the dimensions/format are real.
      const meta = await sharp(result.buffer).metadata();
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(1200);
      expect(meta.format).toBe('png');
    });
  });

  describe('normalizeImage - feature', () => {
    it('cover-crops a 1408x768 near-16:9 source to exactly 1600x900', async () => {
      // aspect 1.833 vs target 1.778 => ~3% off => within 15% => cover-crop
      const input = await solidImage(1408, 768);
      const result = await normalizeImage(input, 'feature');

      expect(result.format).toBe('png');
      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);

      const meta = await sharp(result.buffer).metadata();
      expect(meta.width).toBe(1600);
      expect(meta.height).toBe(900);
      expect(meta.format).toBe('png');
    });

    it('contain-pads a 400x1200 portrait onto the solid background', async () => {
      // aspect 0.333 vs target 1.778 => ~81% off => outside 15% => contain-pad
      const input = await solidImage(400, 1200);
      const result = await normalizeImage(input, 'feature');

      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);

      // The top-left corner must be the padding background #f6f6f7 (246,246,247).
      const { data } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
      expect(data[0]).toBe(246);
      expect(data[1]).toBe(246);
      expect(data[2]).toBe(247);
    });
  });

  describe('normalizeImage - input formats & edge cases', () => {
    it('accepts JPEG input and returns PNG output', async () => {
      const input = await solidImage(1600, 900, { r: 30, g: 30, b: 30 }, 'jpeg');
      const result = await normalizeImage(input, 'feature');

      expect(result.format).toBe('png');
      const meta = await sharp(result.buffer).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(1600);
      expect(meta.height).toBe(900);
    });

    it('upscales a tiny 1x1 input without throwing (icon)', async () => {
      const input = await solidImage(1, 1);
      const result = await normalizeImage(input, 'icon');

      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
    });

    it('upscales a tiny 1x1 input without throwing (feature)', async () => {
      const input = await solidImage(1, 1);
      const result = await normalizeImage(input, 'feature');

      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
    });

    it('rejects an unparseable buffer as bad input (not a crash)', async () => {
      const garbage = Buffer.from('this is not an image at all');
      await expect(normalizeImage(garbage, 'icon')).rejects.toBeInstanceOf(ImageNormalizeError);
    });
  });

  describe('ImageNormalizeError', () => {
    it('is exported and carries a code', () => {
      const err = new ImageNormalizeError('too big', 'TOO_LARGE');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ImageNormalizeError);
      expect(err.name).toBe('ImageNormalizeError');
      expect(err.code).toBe('TOO_LARGE');
    });
  });
});
