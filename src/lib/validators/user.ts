import { z } from 'zod';

export const themeSchema = z.enum(['light', 'dark', 'system']);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email('Invalid email format'),
  selectedGeminiModel: z.string().default('gemini-pro'),
  theme: themeSchema.default('light'),
  autoSave: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  selectedGeminiModel: z.string().default('gemini-pro'),
  theme: themeSchema.default('light'),
  autoSave: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  selectedGeminiModel: z.string().optional(),
  theme: themeSchema.optional(),
  autoSave: z.boolean().optional(),
});

export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type Theme = z.infer<typeof themeSchema>;
