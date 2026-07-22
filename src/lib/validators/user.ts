import { z } from 'zod';

export const themeSchema = z.enum(['light', 'dark', 'system']);

export const screenshotSourceSchema = z.enum(['website', 'repo', 'folder']);

export const userSchema = z.object({
  id: z.string(),
  // Users are keyed by an anonymous client string id; email is optional.
  email: z.string().email('Invalid email format').optional(),
  selectedGeminiModel: z.string().default('auto'),
  theme: themeSchema.default('light'),
  autoSave: z.boolean().default(true),
  screenshotSource: screenshotSourceSchema.default('website'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  selectedGeminiModel: z.string().default('auto'),
  theme: themeSchema.default('light'),
  autoSave: z.boolean().default(true),
  screenshotSource: screenshotSourceSchema.default('website'),
});

export const updateUserSchema = z.object({
  selectedGeminiModel: z.string().optional(),
  theme: themeSchema.optional(),
  autoSave: z.boolean().optional(),
  screenshotSource: screenshotSourceSchema.optional(),
});

export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export type User = z.infer<typeof userSchema>;
// Input type so callers may omit fields that have schema defaults (theme,
// selectedGeminiModel, screenshotSource, autoSave); `createUser` parses to fill them.
export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type ScreenshotSource = z.infer<typeof screenshotSourceSchema>;
