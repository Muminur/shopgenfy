/**
 * Webpage content fetcher for landing page analysis
 *
 * Fetches HTML content from URLs and extracts readable text
 * for AI analysis, removing scripts, styles, and other non-content elements.
 */

export class WebpageFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'WebpageFetchError';
  }
}

export interface FetchOptions {
  maxLength?: number;
  timeout?: number;
}

const DEFAULT_MAX_LENGTH = 15000;
const DEFAULT_TIMEOUT = 30000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Extract readable text content from HTML string
 */
export function extractTextFromHtml(html: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (!html) {
    return '';
  }

  let text = html;

  // Extract meta content first (before removing tags)
  const metaContent: string[] = [];

  // Extract meta description
  const metaDescMatch = text.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  if (metaDescMatch) {
    metaContent.push(metaDescMatch[1]);
  }

  // Extract Open Graph title and description
  const ogTitleMatch = text.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogTitleMatch) {
    metaContent.push(ogTitleMatch[1]);
  }

  const ogDescMatch = text.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogDescMatch) {
    metaContent.push(ogDescMatch[1]);
  }

  // Remove script tags and content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');

  // Remove style tags and content
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

  // Remove noscript tags and content
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  // Remove SVG content
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');

  // Add line breaks for block elements
  text = text.replace(/<\/(h[1-6]|p|div|section|article|header|footer|li|tr|br)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  // Prepend meta content if available
  if (metaContent.length > 0) {
    text = metaContent.join('\n') + '\n\n' + text;
  }

  // Truncate if too long
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '\n\n[Content truncated...]';
  }

  return text.trim();
}

/**
 * Fetch webpage content and extract readable text
 */
export async function fetchWebpageContent(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const { maxLength = DEFAULT_MAX_LENGTH, timeout = DEFAULT_TIMEOUT } = options;

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new WebpageFetchError('Invalid URL format');
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new WebpageFetchError('Only HTTP and HTTPS URLs are allowed');
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new WebpageFetchError(
        `Failed to fetch page: HTTP ${response.status} ${response.statusText}`,
        response.status
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new WebpageFetchError(`URL is not an HTML page (content-type: ${contentType})`);
    }

    const html = await response.text();
    return extractTextFromHtml(html, maxLength);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof WebpageFetchError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new WebpageFetchError('Request timed out');
      }
      throw new WebpageFetchError(`Failed to fetch page: ${error.message}`);
    }

    throw new WebpageFetchError('Failed to fetch page: Unknown error');
  }
}
