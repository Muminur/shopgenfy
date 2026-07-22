/**
 * GitHub repository content fetcher.
 *
 * Turns a `github.com/{owner}/{repo}` link into the same `PreparedContent`
 * shape the URL analysis pipeline consumes, so a repo can feed the shared
 * `analyzeContent` prompt/parse/truncate pipeline in `gemini.ts`.
 *
 * Data is pulled from the public GitHub REST API: repository metadata, the
 * decoded README, `package.json`, and `shopify.app.toml` when present. README
 * image references are resolved to absolute (raw.githubusercontent.com) URLs
 * and downloaded through the shared, SSRF-guarded `fetchImageAsBase64` helper
 * as screenshot candidates.
 *
 * `GITHUB_TOKEN` is optional and supplied by the caller (the analyze route
 * reads it from the environment). Unauthenticated requests are limited to
 * 60/hour per IP; an exhausted rate limit maps to a clear 429 error.
 */

import { GeminiError, type PreparedContent } from './gemini';
import { fetchImageAsBase64 } from './webpage-fetcher';

const DEFAULT_GITHUB_API_BASE = 'https://api.github.com';
/** Cap on README-referenced screenshot candidates downloaded per repo. */
const MAX_IMAGES = 5;
/** Upper bound on the merged text handed to the model. */
const MAX_TEXT_LENGTH = 12000;

export interface ParsedRepo {
  owner: string;
  repo: string;
}

/**
 * Resolve the GitHub REST base URL at call time so `GITHUB_API_BASE` can be
 * overridden in tests / hermetic E2E. Defaults to the production endpoint.
 */
function getGitHubApiBase(): string {
  return process.env.GITHUB_API_BASE || DEFAULT_GITHUB_API_BASE;
}

/**
 * Parse and normalize a GitHub repository URL to `{ owner, repo }`.
 *
 * Accepts protocol-less input, `www.` hosts, trailing slashes, query strings
 * and fragments, and strips `/tree/*`, `/blob/*`, and a trailing `.git`.
 * Throws `GeminiError('Invalid GitHub repository URL')` when the URL is not a
 * GitHub repo link with both an owner and repository segment.
 */
export function parseGitHubRepo(repoUrl: string): ParsedRepo {
  let raw = (repoUrl || '').trim();
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new GeminiError('Invalid GitHub repository URL', 400);
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'github.com') {
    throw new GeminiError('Invalid GitHub repository URL', 400);
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new GeminiError('Invalid GitHub repository URL', 400);
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');
  if (!owner || !repo) {
    throw new GeminiError('Invalid GitHub repository URL', 400);
  }

  return { owner, repo };
}

/**
 * True when the string is a GitHub repository link (host github.com with both
 * an owner and a repository path segment). Used to auto-detect the GitHub
 * input path in the analyze route.
 */
export function isGitHubRepoUrl(url: string): boolean {
  try {
    const { owner, repo } = parseGitHubRepo(url);
    return Boolean(owner && repo);
  } catch {
    return false;
  }
}

/** Decode a base64 payload from the GitHub contents API (may contain newlines). */
function decodeBase64(content: string): string {
  return Buffer.from(content, 'base64').toString('utf-8');
}

/**
 * Map a non-ok GitHub REST response to a typed error. A 404 means the repo
 * does not exist; a 403 with an exhausted rate limit points the user at
 * `GITHUB_TOKEN`; anything else is treated as an upstream failure.
 */
function mapGitHubError(response: Response): GeminiError {
  if (response.status === 404) {
    return new GeminiError('Repository not found', 404);
  }
  if (response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      return new GeminiError('GitHub rate limit exceeded — set GITHUB_TOKEN', 429);
    }
    return new GeminiError('GitHub access forbidden', 403);
  }
  return new GeminiError(
    `GitHub request failed: ${response.status} ${response.statusText}`.trim(),
    502
  );
}

/**
 * Filter out non-screenshot image references: SVG logos/icons and the common
 * CI / coverage / version badge providers. These never represent app UI.
 */
function isBadgeOrIcon(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.svg(\?|#|$)/.test(lower)) {
    return true;
  }
  if (lower.includes('/badge')) {
    return true;
  }
  const badgeHosts = [
    'shields.io',
    'badgen.net',
    'badge.fury.io',
    'travis-ci',
    'circleci.com',
    'coveralls.io',
    'codecov.io',
    'app.netlify.com',
    'david-dm.org',
    'snyk.io',
    'gitpod.io',
  ];
  return badgeHosts.some((host) => lower.includes(host));
}

/**
 * Resolve a README image reference to an absolute http(s) URL. Relative paths
 * resolve against the repo's raw content root; absolute URLs are kept as-is.
 * Root-relative paths (a leading `/`, e.g. `/docs/screenshot.png`) are also
 * resolved against the repo root rather than the host root — `new URL()`
 * would otherwise treat a leading slash as relative to
 * `raw.githubusercontent.com` itself, dropping the owner/repo/branch path
 * and silently breaking the reference. Protocol-relative URLs (`//host/...`)
 * are left untouched since those already name a different host on purpose.
 * Returns null for data URIs and anything that isn't http(s).
 */
function resolveImageUrl(raw: string, rawBase: string): string | null {
  let trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('data:')) {
    return null;
  }
  // Strip surrounding angle brackets used in markdown image syntax: ![](<url>)
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    trimmed = trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    trimmed = trimmed.replace(/^\/+/, '');
  }
  try {
    const resolved = new URL(trimmed, rawBase);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Extract image references from README markdown (both `![alt](url)` and
 * `<img src="...">`), resolve them to absolute raw URLs, drop badges/SVGs, and
 * de-duplicate. Order preserved: markdown images first, then HTML images.
 */
function extractReadmeImageUrls(
  markdown: string,
  owner: string,
  repo: string,
  branch: string
): string[] {
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (candidate: string) => {
    const resolved = resolveImageUrl(candidate, rawBase);
    if (!resolved || isBadgeOrIcon(resolved) || seen.has(resolved)) {
      return;
    }
    seen.add(resolved);
    urls.push(resolved);
  };

  // Markdown images: ![alt](url "optional title") — capture the first token.
  const markdownImageRegex = /!\[[^\]]*\]\(\s*([^)\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownImageRegex.exec(markdown)) !== null) {
    add(match[1]);
  }

  // HTML <img src="..."> tags.
  const htmlImageRegex = /<img[^>]*\ssrc=["']([^"']+)["']/gi;
  while ((match = htmlImageRegex.exec(markdown)) !== null) {
    add(match[1]);
  }

  return urls;
}

/**
 * Fetch a GitHub repository and build `PreparedContent` for the shared
 * analysis pipeline.
 *
 * @param repoUrl A `github.com/{owner}/{repo}` link (any accepted variant).
 * @param token Optional GitHub token; when present an `Authorization: Bearer`
 *   header is sent. The caller (analyze route) supplies it from the
 *   environment so this function stays deterministic in tests.
 */
export async function fetchGitHubRepo(repoUrl: string, token?: string): Promise<PreparedContent> {
  const { owner, repo } = parseGitHubRepo(repoUrl);
  const base = getGitHubApiBase();

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'shopgenfy',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 1. Repository metadata — fetched first so a missing repo / rate limit
  //    surfaces before any other request runs.
  const metadataResponse = await fetch(`${base}/repos/${owner}/${repo}`, { headers });
  if (!metadataResponse.ok) {
    throw mapGitHubError(metadataResponse);
  }
  const metadata = await metadataResponse.json();
  const defaultBranch: string = metadata.default_branch || 'main';
  const title: string = metadata.name || repo;
  const description: string = metadata.description || '';

  // 2. README (base64-encoded markdown).
  let readmeMarkdown = '';
  const readmeResponse = await fetch(`${base}/repos/${owner}/${repo}/readme`, { headers });
  if (readmeResponse.ok) {
    const readmeJson = await readmeResponse.json();
    if (readmeJson?.content) {
      readmeMarkdown = decodeBase64(readmeJson.content);
    }
  }

  // 3. package.json (optional).
  let packageJson: { description?: string; keywords?: string[] } | null = null;
  const packageResponse = await fetch(`${base}/repos/${owner}/${repo}/contents/package.json`, {
    headers,
  });
  if (packageResponse.ok) {
    const packageFile = await packageResponse.json();
    if (packageFile?.content) {
      try {
        packageJson = JSON.parse(decodeBase64(packageFile.content));
      } catch {
        packageJson = null;
      }
    }
  }

  // 4. shopify.app.toml (optional).
  let shopifyToml = '';
  const tomlResponse = await fetch(`${base}/repos/${owner}/${repo}/contents/shopify.app.toml`, {
    headers,
  });
  if (tomlResponse.ok) {
    const tomlFile = await tomlResponse.json();
    if (tomlFile?.content) {
      shopifyToml = decodeBase64(tomlFile.content);
    }
  }

  // Merge everything into a single text blob for the model.
  const parts: string[] = [];
  if (description) {
    parts.push(description);
  }
  if (readmeMarkdown) {
    parts.push(readmeMarkdown);
  }
  if (packageJson?.description) {
    parts.push(`Package description: ${packageJson.description}`);
  }
  if (Array.isArray(packageJson?.keywords) && packageJson.keywords.length > 0) {
    parts.push(`Keywords: ${packageJson.keywords.join(', ')}`);
  }
  if (Array.isArray(metadata.topics) && metadata.topics.length > 0) {
    parts.push(`Topics: ${metadata.topics.join(', ')}`);
  }
  if (metadata.language) {
    parts.push(`Primary language: ${metadata.language}`);
  }
  if (metadata.homepage) {
    parts.push(`Homepage: ${metadata.homepage}`);
  }
  if (shopifyToml) {
    parts.push(`Shopify app configuration:\n${shopifyToml}`);
  }

  let textContent = parts.join('\n\n');
  if (textContent.length > MAX_TEXT_LENGTH) {
    textContent = textContent.slice(0, MAX_TEXT_LENGTH);
  }

  // Download README-referenced screenshot candidates (capped, SSRF-guarded).
  const imageUrls = extractReadmeImageUrls(readmeMarkdown, owner, repo, defaultBranch).slice(
    0,
    MAX_IMAGES
  );
  const images: { base64: string; mimeType: string }[] = [];
  for (const imageUrl of imageUrls) {
    const fetched = await fetchImageAsBase64(imageUrl);
    if (fetched) {
      images.push({ base64: fetched.base64, mimeType: fetched.mimeType });
    }
  }

  return {
    title,
    description,
    textContent,
    images,
    sourceLabel: `GitHub repository ${owner}/${repo}`,
  };
}
