import { describe, it, expect } from 'vitest';
import { createImageSchema, validateImageDimensions } from '@/lib/validators/image';
import { IMAGE_SPECS } from '@/lib/validators/constants';

describe('Image Validation Schema', () => {
  const validImage = {
    submissionId: 'sub123',
    type: 'feature' as const,
    driveFileId: 'file123',
    driveUrl: 'https://drive.google.com/file/123',
    width: 1600,
    height: 900,
    format: 'png' as const,
    generationPrompt: 'A clean feature image',
    featureHighlighted: 'Dashboard overview',
    altText: 'Dashboard showing analytics',
    version: 1,
  };

  describe('createImageSchema', () => {
    it('should accept valid image data', () => {
      const result = createImageSchema.safeParse(validImage);
      expect(result.success).toBe(true);
    });

    it('should reject invalid image type', () => {
      const result = createImageSchema.safeParse({
        ...validImage,
        type: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid image format', () => {
      const result = createImageSchema.safeParse({
        ...validImage,
        format: 'gif',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL', () => {
      const result = createImageSchema.safeParse({
        ...validImage,
        driveUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should reject alt text exceeding 125 characters', () => {
      const result = createImageSchema.safeParse({
        ...validImage,
        altText: 'A'.repeat(126),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateImageDimensions', () => {
    it('should validate correct icon dimensions', () => {
      const result = validateImageDimensions(
        'icon',
        IMAGE_SPECS.ICON.width,
        IMAGE_SPECS.ICON.height
      );
      expect(result.valid).toBe(true);
    });

    it('should validate correct feature dimensions', () => {
      const result = validateImageDimensions(
        'feature',
        IMAGE_SPECS.FEATURE.width,
        IMAGE_SPECS.FEATURE.height
      );
      expect(result.valid).toBe(true);
    });

    it('should reject incorrect icon dimensions', () => {
      const result = validateImageDimensions('icon', 500, 500);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('1200x1200');
    });

    it('should reject incorrect feature dimensions', () => {
      const result = validateImageDimensions('feature', 1920, 1080);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('1600x900');
    });
  });
});
