import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWebpageContent,
  fetchWebpageWithImages,
  fetchImageAsBase64,
  extractTextFromHtml,
  WebpageFetchError,
} from '@/lib/webpage-fetcher';
import { lookup } from 'node:dns/promises';

// DNS is mocked so unit tests never touch the network and can simulate a
// public-looking hostname that actually resolves to an internal IP — the core
// SSRF-via-DNS bypass the string-only host check could not catch. The real
// module exposes both a named and a default `lookup`; the mock backs both with
// the SAME spy so it works regardless of how the import is interop-compiled.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({
  default: { lookup: lookupMock },
  lookup: lookupMock,
}));

const PUBLIC_DNS = [{ address: '93.184.216.34', family: 4 }];

describe('WebpageFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: every hostname resolves to a public IP so the existing
    // fetch-mock tests behave exactly as they did before DNS validation.
    vi.mocked(lookup).mockResolvedValue(PUBLIC_DNS as never);
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

  describe('SSRF protection (DNS resolution + redirect re-validation)', () => {
    it('rejects a public-looking hostname that resolves to a private (RFC1918) IP', async () => {
      vi.mocked(lookup).mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);
      global.fetch = vi.fn();

      await expect(fetchWebpageContent('https://innocuous.example.com')).rejects.toThrow(
        WebpageFetchError
      );
      await expect(fetchWebpageContent('https://innocuous.example.com')).rejects.toThrow(/SSRF/i);
      // The blocked address is caught before any network request is made.
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a hostname that resolves to the cloud metadata IP (169.254.169.254)', async () => {
      vi.mocked(lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never);
      global.fetch = vi.fn();

      await expect(fetchWebpageContent('https://metadata-lookalike.example.com')).rejects.toThrow(
        WebpageFetchError
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a hostname when any one of several resolved IPs is internal', async () => {
      vi.mocked(lookup).mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '192.168.1.20', family: 4 },
      ] as never);
      global.fetch = vi.fn();

      await expect(fetchWebpageContent('https://mixed.example.com')).rejects.toThrow(/SSRF/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not follow a 302 redirect to a literal internal IP', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 302,
        ok: false,
        headers: {
          get: (n: string) =>
            n.toLowerCase() === 'location' ? 'http://169.254.169.254/latest/meta-data/' : null,
        },
      });

      await expect(fetchWebpageContent('https://safe-start.example.com')).rejects.toThrow(/SSRF/i);
      // Only the first hop was requested; the redirect target was never fetched.
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('re-validates redirect targets via DNS and rejects one resolving internal', async () => {
      vi.mocked(lookup).mockImplementation((async (host: string) =>
        host === 'evil-redirect.example.com'
          ? [{ address: '10.1.2.3', family: 4 }]
          : PUBLIC_DNS) as never);
      global.fetch = vi.fn().mockResolvedValue({
        status: 302,
        ok: false,
        headers: {
          get: (n: string) =>
            n.toLowerCase() === 'location' ? 'https://evil-redirect.example.com/' : null,
        },
      });

      await expect(fetchWebpageContent('https://safe-start.example.com')).rejects.toThrow(/SSRF/i);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('caps the number of redirects it will follow', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 302,
        ok: false,
        headers: {
          get: (n: string) =>
            n.toLowerCase() === 'location' ? 'https://another.example.com/' : null,
        },
      });

      await expect(fetchWebpageContent('https://start.example.com')).rejects.toThrow(
        /too many redirects/i
      );
      // 1 initial request + at most 5 redirect hops.
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(calls).toBeGreaterThan(1);
      expect(calls).toBeLessThanOrEqual(6);
    });

    it('fetchWebpageWithImages also rejects internal-resolving hosts', async () => {
      vi.mocked(lookup).mockResolvedValue([{ address: '192.168.1.10', family: 4 }] as never);
      global.fetch = vi.fn();

      await expect(fetchWebpageWithImages('https://looks-fine.example.com')).rejects.toThrow(
        /SSRF/i
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetchImageAsBase64 returns null when the host resolves to loopback', async () => {
      vi.mocked(lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
      global.fetch = vi.fn();

      const result = await fetchImageAsBase64('https://img.example.com/pic.png');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetchImageAsBase64 returns null when a redirect points at an internal IP', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 302,
        ok: false,
        headers: {
          get: (n: string) =>
            n.toLowerCase() === 'location' ? 'http://10.0.0.9/secret.png' : null,
        },
      });

      const result = await fetchImageAsBase64('https://img.example.com/pic.png');

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
