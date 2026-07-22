/**
 * Webpage content fetcher for landing page analysis
 *
 * Fetches HTML content from URLs and extracts readable text
 * for AI analysis, removing scripts, styles, and other non-content elements.
 */

import { lookup } from 'node:dns/promises';

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
  extractImages?: boolean;
}

export interface ExtractedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface WebpageContent {
  text: string;
  images: ExtractedImage[];
}

const DEFAULT_MAX_LENGTH = 15000;
const DEFAULT_TIMEOUT = 30000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB max per image

/**
 * Check if a URL is safe (not targeting internal networks or localhost)
 * Prevents SSRF attacks
 */
function isSafeUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();

  // Block localhost and loopback
  if (hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1') {
    return false;
  }

  // Block private IP ranges (RFC 1918)
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  const privateIPRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
  if (privateIPRegex.test(hostname)) {
    return false;
  }

  // Block link-local addresses (169.254.x.x - includes AWS metadata endpoint)
  if (hostname.startsWith('169.254.')) {
    return false;
  }

  // Block common internal hostnames
  const blockedHostnames = ['metadata', 'internal', 'localhost.localdomain'];
  if (blockedHostnames.some((blocked) => hostname.includes(blocked))) {
    return false;
  }

  return true;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Maximum redirect hops any fetch through this module will follow. */
const MAX_REDIRECTS = 5;

/**
 * Decide whether a resolved IP address targets a private, loopback, link-local,
 * or otherwise non-routable range. This is the check the string-based
 * `isSafeUrl` cannot make: a public-looking hostname can resolve (via DNS) to an
 * internal IP, and a redirect can point at one.
 */
function isBlockedIpAddress(ip: string): boolean {
  let addr = ip.toLowerCase().trim();

  // Unwrap IPv4-mapped/compat IPv6 forms such as ::ffff:169.254.169.254.
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    addr = mapped[1];
  }

  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr)) {
    const [a, b] = addr.split('.').map((part) => parseInt(part, 10));
    if (a === 0) return true; // "this" network / 0.0.0.0
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.0.0/16)
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
    return false;
  }

  // IPv6
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true; // unique local address fc00::/7
  return false;
}

/**
 * Full safety check for a URL about to be fetched: the synchronous string check
 * first (fast rejection of literal internal hosts/IPs), then DNS resolution with
 * every returned address validated against the blocklist. Any unresolved or
 * blocked address makes the URL unsafe.
 */
async function isSafeUrlWithDns(url: URL): Promise<boolean> {
  // Fast string-based rejection first (literal internal hostnames / IPs).
  if (!isSafeUrl(url)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');

  let resolved: Array<{ address: string }>;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    // A hostname we cannot resolve is treated as unsafe rather than handed to
    // fetch (which would resolve it itself, unchecked).
    return false;
  }

  if (!resolved || resolved.length === 0) {
    return false;
  }

  for (const { address } of resolved) {
    if (isBlockedIpAddress(address)) {
      return false;
    }
  }

  return true;
}

/**
 * SSRF-hardened fetch. Validates the target (string + DNS) before every hop,
 * follows redirects manually so each `Location` is re-validated (an attacker
 * server cannot 302 us to an internal address), and caps the redirect chain.
 * Throws {@link WebpageFetchError} for unsafe targets or excessive redirects.
 */
async function safeFetch(url: string, init: RequestInit, timeout: number): Promise<Response> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new WebpageFetchError('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new WebpageFetchError('Only HTTP and HTTPS URLs are allowed');
    }

    if (!(await isSafeUrlWithDns(parsed))) {
      throw new WebpageFetchError('URL targets a blocked network (SSRF protection)');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...init,
        signal: controller.signal,
        // Manual so we re-validate each redirect target before following it.
        redirect: 'manual',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 3xx (except 304 Not Modified) is a redirect we handle ourselves.
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }

  throw new WebpageFetchError('Too many redirects');
}

/**
 * Extract image URLs from HTML string
 * Prioritizes high-quality images that look like screenshots or feature images
 */
export function extractImagesFromHtml(html: string, baseUrl: string): ExtractedImage[] {
  if (!html) {
    return [];
  }

  const images: ExtractedImage[] = [];
  const seenUrls = new Set<string>();

  // Match img tags with src attribute
  const imgRegex = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const fullTag = match[0];
    let src = match[1];

    // Skip data URIs, SVGs, tracking pixels, and very small images
    if (
      src.startsWith('data:') ||
      src.includes('.svg') ||
      src.includes('pixel') ||
      src.includes('tracking') ||
      src.includes('spacer') ||
      src.includes('1x1')
    ) {
      continue;
    }

    // Resolve relative URLs
    try {
      const absoluteUrl = new URL(src, baseUrl).href;
      src = absoluteUrl;
    } catch {
      continue;
    }

    // Skip if already seen
    if (seenUrls.has(src)) {
      continue;
    }
    seenUrls.add(src);

    // Extract alt text
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : undefined;

    // Extract dimensions if available
    const widthMatch = fullTag.match(/width=["']?(\d+)/i);
    const heightMatch = fullTag.match(/height=["']?(\d+)/i);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : undefined;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : undefined;

    // Skip very small images (likely icons or bullets)
    if (width && height && (width < 100 || height < 100)) {
      continue;
    }

    images.push({ url: src, alt, width, height });
  }

  // Also extract from srcset for responsive images
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    // Get the largest image from srcset
    const sources = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]);
    for (const src of sources) {
      if (src.startsWith('data:') || src.includes('.svg')) continue;
      try {
        const absoluteUrl = new URL(src, baseUrl).href;
        if (!seenUrls.has(absoluteUrl)) {
          seenUrls.add(absoluteUrl);
          images.push({ url: absoluteUrl });
        }
      } catch {
        continue;
      }
    }
  }

  // Also extract from Open Graph images (often high quality)
  const ogImageRegex = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi;
  while ((match = ogImageRegex.exec(html)) !== null) {
    const src = match[1];
    try {
      const absoluteUrl = new URL(src, baseUrl).href;
      if (!seenUrls.has(absoluteUrl)) {
        seenUrls.add(absoluteUrl);
        // Prioritize OG images at the beginning
        images.unshift({ url: absoluteUrl, alt: 'Open Graph preview image' });
      }
    } catch {
      continue;
    }
  }

  // Prioritize images that look like screenshots or feature images
  // (larger dimensions, contains words like screenshot, preview, demo, feature)
  return images.sort((a, b) => {
    const aScore = getImagePriorityScore(a);
    const bScore = getImagePriorityScore(b);
    return bScore - aScore;
  });
}

function getImagePriorityScore(image: ExtractedImage): number {
  let score = 0;

  // Prefer larger images
  if (image.width && image.height) {
    score += Math.min((image.width * image.height) / 10000, 100);
  }

  const url = image.url.toLowerCase();
  const alt = (image.alt || '').toLowerCase();

  // Boost for screenshot-like names
  const screenshotKeywords = [
    'screenshot',
    'preview',
    'demo',
    'feature',
    'dashboard',
    'app',
    'screen',
    'hero',
    'banner',
  ];
  for (const keyword of screenshotKeywords) {
    if (url.includes(keyword) || alt.includes(keyword)) {
      score += 50;
      break;
    }
  }

  // Penalize common non-screenshot patterns
  const penaltyKeywords = [
    'logo',
    'icon',
    'avatar',
    'profile',
    'badge',
    'button',
    'arrow',
    'social',
  ];
  for (const keyword of penaltyKeywords) {
    if (url.includes(keyword) || alt.includes(keyword)) {
      score -= 30;
      break;
    }
  }

  // Prefer PNG and high-quality JPEGs
  if (url.includes('.png')) score += 10;
  if (url.includes('.webp')) score += 5;

  return score;
}

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

  // SSRF protection: full validation (string + DNS) happens inside safeFetch on
  // every hop, including redirect targets, which are followed manually.
  try {
    const response = await safeFetch(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      timeout
    );

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

/**
 * Fetch webpage content with both text and images
 */
export async function fetchWebpageWithImages(
  url: string,
  options: FetchOptions = {}
): Promise<WebpageContent> {
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

  // SSRF protection: full validation (string + DNS) happens inside safeFetch on
  // every hop, including redirect targets, which are followed manually.
  try {
    const response = await safeFetch(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      timeout
    );

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
    const text = extractTextFromHtml(html, maxLength);
    const images = extractImagesFromHtml(html, url);

    return { text, images };
  } catch (error) {
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

/**
 * Fetch an image and return its base64 data
 */
export async function fetchImageAsBase64(
  imageUrl: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<{ base64: string; mimeType: string } | null> {
  // Validate URL format and security
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return null; // Invalid URL format
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return null;
  }

  // SSRF protection: full validation (string + DNS) happens inside safeFetch on
  // every hop, including redirect targets, which are followed manually.
  try {
    const response = await safeFetch(
      imageUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'image/*',
        },
      },
      timeout
    );

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return null;
    }

    // Check content length to prevent downloading huge files
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    // Double-check actual size after download (in case content-length was missing/wrong)
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return null;
    }
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Normalize mime type
    let mimeType = contentType.split(';')[0].trim();
    if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

    return { base64, mimeType };
  } catch {
    return null;
  }
}
