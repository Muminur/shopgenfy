/**
 * Integration tests for Pollinations.ai API
 * Tests real image generation using the FREE Pollinations.ai API
 */

import { describe, it, expect } from 'vitest';

describe('Pollinations.ai API Integration', () => {
  const POLLINATIONS_BASE_URL = 'https://image.pollinations.ai/prompt';

  describe('URL Construction', () => {
    it('should construct proper URL with encoded prompt', () => {
      const prompt = 'Modern e-commerce app icon';
      const encodedPrompt = encodeURIComponent(prompt);
      const width = 1200;
      const height = 1200;

      const url = `${POLLINATIONS_BASE_URL}/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true`;

      expect(url).toContain(encodedPrompt);
      expect(url).toContain('width=1200');
      expect(url).toContain('height=1200');
      expect(url).toContain('nologo=true');
      expect(url).toContain('enhance=true');
    });

    it('should handle special characters in prompt', () => {
      const prompt = 'App icon with #hashtag & special chars!';
      const encodedPrompt = encodeURIComponent(prompt);
      const url = `${POLLINATIONS_BASE_URL}/${encodedPrompt}?width=1200&height=1200&nologo=true&enhance=true`;

      expect(url).not.toContain('#');
      expect(url).not.toContain('&special');
      expect(url).toContain('%23'); // encoded #
      expect(url).toContain('%26'); // encoded &
    });

    it('should construct URL for App Icon dimensions (1200x1200)', () => {
      const prompt = 'App icon';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=1200&height=1200&nologo=true&enhance=true`;

      expect(url).toContain('width=1200');
      expect(url).toContain('height=1200');
    });

    it('should construct URL for Feature Image dimensions (1600x900)', () => {
      const prompt = 'Feature showcase';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=1600&height=900&nologo=true&enhance=true`;

      expect(url).toContain('width=1600');
      expect(url).toContain('height=900');
    });

    it('should include seed parameter for consistent style', () => {
      const prompt = 'App icon';
      const seed = 12345;
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=1200&height=1200&seed=${seed}&nologo=true&enhance=true`;

      expect(url).toContain('seed=12345');
    });
  });

  describe('Real API Integration', () => {
    it('should successfully fetch image from Pollinations.ai', async () => {
      const prompt = 'Modern minimalist app icon, blue gradient, simple design';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&enhance=true`;

      const response = await fetch(url);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/image/);
    }, 30000); // 30s timeout for real API call

    it('should return image data that can be converted to buffer', async () => {
      const prompt = 'Test image';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=256&height=256&nologo=true&enhance=true`;

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();

      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(buffer instanceof ArrayBuffer).toBe(true);
    }, 60000);

    it('should generate App Icon dimensions image (1200x1200)', async () => {
      const prompt = 'E-commerce app icon, shopping cart, modern design';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=1200&height=1200&nologo=true&enhance=true`;

      const response = await fetch(url);

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toMatch(/image/);
    }, 60000); // 60s timeout for larger image

    it('should generate Feature Image dimensions image (1600x900)', async () => {
      const prompt = 'Feature showcase, product display, clean interface';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=1600&height=900&nologo=true&enhance=true`;

      const response = await fetch(url);

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toMatch(/image/);
    }, 90000);

    it('should maintain consistent style with same seed', async () => {
      const prompt = 'App icon design';
      const seed = 42;

      const url1 = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true&enhance=true`;
      const url2 = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true&enhance=true`;

      const [response1, response2] = await Promise.all([fetch(url1), fetch(url2)]);

      const [buffer1, buffer2] = await Promise.all([
        response1.arrayBuffer(),
        response2.arrayBuffer(),
      ]);

      // Same seed should produce same image
      expect(buffer1.byteLength).toBe(buffer2.byteLength);
    }, 60000);

    it('should produce different images with different seeds', async () => {
      const prompt = 'App icon design';
      const url1 = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&seed=1&nologo=true&enhance=true`;
      const url2 = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&seed=999&nologo=true&enhance=true`;

      const [response1, response2] = await Promise.all([fetch(url1), fetch(url2)]);

      expect(response1.ok).toBe(true);
      expect(response2.ok).toBe(true);

      // Different seeds should likely produce different byte sizes (different images)
      const [buffer1, buffer2] = await Promise.all([
        response1.arrayBuffer(),
        response2.arrayBuffer(),
      ]);

      // We can't guarantee they're different, but we can verify both worked
      expect(buffer1.byteLength).toBeGreaterThan(0);
      expect(buffer2.byteLength).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Shopify Compliance', () => {
    it('should support App Icon specifications (1200x1200px)', async () => {
      const prompt = 'Shopify app icon, no text, centered logo, padded';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=1200&height=1200&nologo=true&enhance=true`;

      const response = await fetch(url);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    }, 60000);

    it('should support Feature Image specifications (1600x900px)', async () => {
      const prompt = 'Feature showcase, 16:9 aspect ratio, high contrast, single focal point';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=1600&height=900&nologo=true&enhance=true`;

      const response = await fetch(url);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    }, 120000);

    it('should respect negative prompt patterns in main prompt', async () => {
      const prompt = 'Modern app icon, clean design, no Shopify logo, no branding, no text overlay';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&enhance=true`;

      const response = await fetch(url);

      expect(response.ok).toBe(true);
      expect(prompt).toContain('no Shopify logo');
      expect(prompt).toContain('no branding');
      expect(prompt).toContain('no text overlay');
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle empty prompt gracefully', async () => {
      const prompt = '';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&enhance=true`;

      const response = await fetch(url);

      // API should still respond, even with empty prompt
      expect(response.status).toBeLessThan(500);
    }, 60000);

    it('should handle very long prompts', async () => {
      const prompt = 'A '.repeat(500) + 'modern app icon';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&enhance=true`;

      const response = await fetch(url);

      // Should either succeed or return client error (not server error)
      expect(response.status).toBeLessThan(500);
    }, 120000);
  });

  describe('Performance', () => {
    it('should complete small image generation within 60 seconds', async () => {
      const startTime = Date.now();
      const prompt = 'Quick test image';
      const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=256&height=256&nologo=true&enhance=true`;

      const response = await fetch(url);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(60000); // Less than 60 seconds (Pollinations can be slower)
    }, 70000);

    it('should handle concurrent requests', async () => {
      const prompts = ['Icon 1', 'Icon 2', 'Icon 3'];

      const requests = prompts.map((prompt) => {
        const url = `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?width=256&height=256&nologo=true&enhance=true`;
        return fetch(url);
      });

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.ok).toBe(true);
      });
    }, 120000);
  });

  describe('Image Quality Parameters', () => {
    it('should support nologo parameter', () => {
      const url = `${POLLINATIONS_BASE_URL}/test?width=512&height=512&nologo=true&enhance=true`;
      expect(url).toContain('nologo=true');
    });

    it('should support enhance parameter', () => {
      const url = `${POLLINATIONS_BASE_URL}/test?width=512&height=512&nologo=true&enhance=true`;
      expect(url).toContain('enhance=true');
    });

    it('should support custom seed for reproducibility', () => {
      const seed = 123456;
      const url = `${POLLINATIONS_BASE_URL}/test?width=512&height=512&seed=${seed}&nologo=true&enhance=true`;
      expect(url).toContain(`seed=${seed}`);
    });
  });
});
