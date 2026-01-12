import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema, validateEmail } from '@/lib/validators/user';

describe('User Validation Schema', () => {
  describe('createUserSchema', () => {
    it('should accept valid user data', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedGeminiModel).toBe('gemini-2.0-flash');
        expect(result.data.theme).toBe('light');
      }
    });

    it('should reject invalid email', () => {
      const result = createUserSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('should accept custom theme', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        theme: 'dark',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.theme).toBe('dark');
      }
    });
  });

  describe('updateUserSchema', () => {
    it('should allow updating theme only', () => {
      const result = updateUserSchema.safeParse({
        theme: 'dark',
      });
      expect(result.success).toBe(true);
    });

    it('should allow updating model only', () => {
      const result = updateUserSchema.safeParse({
        selectedGeminiModel: 'gemini-pro-vision',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid theme value', () => {
      const result = updateUserSchema.safeParse({
        theme: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.org')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(validateEmail('not-an-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
    });
  });
});
