import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWebpageContent, extractTextFromHtml, WebpageFetchError } from '@/lib/webpage-fetcher';

describe('WebpageFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractTextFromHtml', () => {
    it('should extract text content from HTML', () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Welcome to My App</h1>
            <p>This is a description of the app.</p>
            <ul>
              <li>Feature 1</li>
              <li>Feature 2</li>
            </ul>
          </body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).toContain('Welcome to My App');
      expect(text).toContain('This is a description of the app');
      expect(text).toContain('Feature 1');
      expect(text).toContain('Feature 2');
    });

    it('should remove script tags and their content', () => {
      const html = `
        <html>
          <body>
            <p>Visible text</p>
            <script>console.log('hidden');</script>
            <script src="app.js"></script>
          </body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).toContain('Visible text');
      expect(text).not.toContain('console.log');
      expect(text).not.toContain('hidden');
    });

    it('should remove style tags and their content', () => {
      const html = `
        <html>
          <body>
            <style>.hidden { display: none; }</style>
            <p>Visible text</p>
          </body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).toContain('Visible text');
      expect(text).not.toContain('.hidden');
      expect(text).not.toContain('display');
    });

    it('should remove noscript content', () => {
      const html = `
        <html>
          <body>
            <p>Main content</p>
            <noscript>Please enable JavaScript</noscript>
          </body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).toContain('Main content');
      expect(text).not.toContain('enable JavaScript');
    });

    it('should normalize whitespace', () => {
      const html = `
        <html>
          <body>
            <p>Text   with    multiple     spaces</p>
            <p>And


            newlines</p>
          </body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).not.toMatch(/\s{3,}/);
    });

    it('should preserve semantic structure with line breaks', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).toContain('Title');
      expect(text).toContain('Paragraph 1');
      expect(text).toContain('Paragraph 2');
    });

    it('should handle empty HTML', () => {
      const text = extractTextFromHtml('');
      expect(text).toBe('');
    });

    it('should handle HTML with only tags', () => {
      const html = '<html><head></head><body></body></html>';
      const text = extractTextFromHtml(html);
      expect(text.trim()).toBe('');
    });

    it('should limit output length', () => {
      const longContent = 'A'.repeat(100000);
      const html = `<html><body><p>${longContent}</p></body></html>`;

      const text = extractTextFromHtml(html, 5000);

      expect(text.length).toBeLessThanOrEqual(5100); // Allow small buffer for truncation message
    });

    it('should extract meta description', () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="This is the meta description">
          </head>
          <body><p>Body content</p></body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).toContain('This is the meta description');
    });

    it('should extract open graph content', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="OG Title">
            <meta property="og:description" content="OG Description">
          </head>
          <body><p>Body content</p></body>
        </html>
      `;

      const text = extractTextFromHtml(html);

      expect(text).toContain('OG Title');
      expect(text).toContain('OG Description');
    });
  });

  describe('fetchWebpageContent', () => {
    it('should fetch and extract content from a URL', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Test App</h1>
            <p>A great application for testing.</p>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        text: () => Promise.resolve(mockHtml),
      });

      const content = await fetchWebpageContent('https://example.com');

      expect(content).toContain('Test App');
      expect(content).toContain('A great application for testing');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
    });

    it('should validate URL format', async () => {
      await expect(fetchWebpageContent('not-a-url')).rejects.toThrow(WebpageFetchError);
      await expect(fetchWebpageContent('not-a-url')).rejects.toThrow('Invalid URL');
    });

    it('should only allow HTTP/HTTPS protocols', async () => {
      await expect(fetchWebpageContent('ftp://example.com')).rejects.toThrow(WebpageFetchError);
      await expect(fetchWebpageContent('file:///etc/passwd')).rejects.toThrow(WebpageFetchError);
    });

    it('should handle non-200 responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fetchWebpageContent('https://example.com/404')).rejects.toThrow(
        WebpageFetchError
      );
      await expect(fetchWebpageContent('https://example.com/404')).rejects.toThrow('404');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(fetchWebpageContent('https://unreachable.test')).rejects.toThrow(
        WebpageFetchError
      );
    });

    it('should handle timeout', async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 100);
          })
      );

      await expect(fetchWebpageContent('https://slow.test')).rejects.toThrow(WebpageFetchError);
    });

    it('should follow redirects', async () => {
      const mockHtml = '<html><body>Final page</body></html>';

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        text: () => Promise.resolve(mockHtml),
      });

      const content = await fetchWebpageContent('https://example.com/redirect');

      expect(content).toContain('Final page');
    });

    it('should reject non-HTML content types', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        text: () => Promise.resolve('{"data": "json"}'),
      });

      await expect(fetchWebpageContent('https://api.example.com/data')).rejects.toThrow(
        WebpageFetchError
      );
      await expect(fetchWebpageContent('https://api.example.com/data')).rejects.toThrow(
        'not an HTML page'
      );
    });

    it('should include proper user-agent header', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'text/html',
        },
        text: () => Promise.resolve('<html></html>'),
      });

      await fetchWebpageContent('https://example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
          }),
        })
      );
    });

    it('should handle large pages by truncating content', async () => {
      const largeContent = 'Word '.repeat(50000);
      const mockHtml = `<html><body><p>${largeContent}</p></body></html>`;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'text/html',
        },
        text: () => Promise.resolve(mockHtml),
      });

      const content = await fetchWebpageContent('https://example.com', { maxLength: 10000 });

      expect(content.length).toBeLessThanOrEqual(10100);
    });
  });
});
