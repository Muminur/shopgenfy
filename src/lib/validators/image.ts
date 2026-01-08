import { z } from 'zod';
import { IMAGE_SPECS } from './constants';

export const imageTypeSchema = z.enum(['icon', 'feature']);
export const imageFormatSchema = z.enum(['png', 'jpeg']);

export const generatedImageSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  type: imageTypeSchema,
  driveFileId: z.string(),
  driveUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: imageFormatSchema,
  generationPrompt: z.string(),
  featureHighlighted: z.string(),
  altText: z.string().max(125, 'Alt text must be 125 characters or less'),
  version: z.number().int().min(1),
  createdAt: z.date(),
});

export const createImageSchema = generatedImageSchema.omit({
  id: true,
  createdAt: true,
});

export const iconDimensionsSchema = z.object({
  width: z.literal(IMAGE_SPECS.ICON.width),
  height: z.literal(IMAGE_SPECS.ICON.height),
});

export const featureDimensionsSchema = z.object({
  width: z.literal(IMAGE_SPECS.FEATURE.width),
  height: z.literal(IMAGE_SPECS.FEATURE.height),
});

export function validateImageDimensions(
  type: 'icon' | 'feature',
  width: number,
  height: number
): { valid: boolean; message?: string } {
  const specs = type === 'icon' ? IMAGE_SPECS.ICON : IMAGE_SPECS.FEATURE;

  if (width !== specs.width || height !== specs.height) {
    return {
      valid: false,
      message: `${type === 'icon' ? 'Icon' : 'Feature image'} must be ${specs.width}x${specs.height}px`,
    };
  }

  return { valid: true };
}

export type GeneratedImage = z.infer<typeof generatedImageSchema>;
export type CreateImageInput = z.infer<typeof createImageSchema>;
export type ImageType = z.infer<typeof imageTypeSchema>;
export type ImageFormat = z.infer<typeof imageFormatSchema>;
