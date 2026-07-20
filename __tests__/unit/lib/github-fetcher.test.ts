import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGitHubRepo, isGitHubRepoUrl, fetchGitHubRepo } from '@/lib/github-fetcher';
import { GeminiError } from '@/lib/gemini';

// The GitHub fetcher resolves README-referenced images to absolute URLs and
// downloads them through the shared, SSRF-guarded helper.
vi.mock('@/lib/webpage-fetcher', () => ({
  fetchImageAsBase64: vi.fn(),
}));

import { fetchImageAsBase64 } from '@/lib/webpage-fetcher';

/** Base64-encode a UTF-8 string the way the GitHub contents API does. */
function b64(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

const OWNER = 'sindresorhus';
const REPO = 'is-online';

const README_MARKDOWN = [
  '# is-online',
  '',
  'Check if the internet connection is up.',
  '',
  '![screenshot](media/screenshot.png)',
  '',
  '<img src="https://cdn.example.com/demo.png" alt="demo" />',
  '',
  '![logo](./assets/logo.svg)',
  '',
  '[![Build Status](https://img.shields.io/badge/build-passing-green)](https://ci.example.com)',
].join('\n');

const PACKAGE_JSON = JSON.stringify({
  name: 'is-online',
  description: 'Check if the internet connection is up',
  keywords: ['internet', 'online', 'offline', 'connectivity'],
});

interface MockRes {
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * A vitest mock that is also assignable to the overloaded `typeof fetch`.
 * Lets tests both `global.fetch = mockGitHubFetch()` and read `.mock.calls`.
 */
type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

function makeResponse(res: MockRes): Response {
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText ?? '',
    headers: {
      get: (key: string) => res.headers?.[key.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(res.body ?? {}),
  } as unknown as Response;
}

/**
 * Build a fetch mock that routes GitHub REST endpoints by URL. Any endpoint
 * not explicitly overridden returns 404 (mirroring a missing file).
 */
function mockGitHubFetch(overrides: Record<string, MockRes> = {}): FetchMock {
  const metadata: MockRes = {
    ok: true,
    status: 200,
    body: {
      name: 'is-online',
      full_name: 'sindresorhus/is-online',
      description: 'Check if the internet connection is up',
      default_branch: 'main',
      homepage: 'https://sindresorhus.com',
      topics: ['internet', 'online', 'connectivity'],
      language: 'JavaScript',
    },
  };
  const readme: MockRes = {
    ok: true,
    status: 200,
    body: { content: b64(README_MARKDOWN), encoding: 'base64' },
  };
  const packageJson: MockRes = {
    ok: true,
    status: 200,
    body: { content: b64(PACKAGE_JSON), encoding: 'base64' },
  };

  return vi.fn((input: string | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [needle, res] of Object.entries(overrides)) {
      if (url.includes(needle)) return Promise.resolve(makeResponse(res));
    }
    if (url.includes('/readme')) return Promise.resolve(makeResponse(readme));
    if (url.includes('/contents/package.json')) return Promise.resolve(makeResponse(packageJson));
    if (url.includes('/contents/shopify.app.toml'))
      return Promise.resolve(makeResponse({ ok: false, status: 404 }));
    if (url.includes(`/repos/${OWNER}/${REPO}`)) return Promise.resolve(makeResponse(metadata));
    return Promise.resolve(makeResponse({ ok: false, status: 404 }));
  }) as unknown as FetchMock;
}

describe('parseGitHubRepo', () => {
  it('parses a canonical repo URL', () => {
    expect(parseGitHubRepo('https://github.com/sindresorhus/is-online')).toEqual({
      owner: 'sindresorhus',
      repo: 'is-online',
    });
  });

  it('strips a trailing .git suffix', () => {
    expect(parseGitHubRepo('https://github.com/sindresorhus/is-online.git')).toEqual({
      owner: 'sindresorhus',
      repo: 'is-online',
    });
  });

  it('strips a /tree/<branch> suffix', () => {
    expect(parseGitHubRepo('https://github.com/sindresorhus/is-online/tree/main')).toEqual({
      owner: 'sindresorhus',
      repo: 'is-online',
    });
  });

  it('strips a /blob/<branch>/<path> suffix', () => {
    expect(
      parseGitHubRepo('https://github.com/sindresorhus/is-online/blob/main/readme.md')
    ).toEqual({ owner: 'sindresorhus', repo: 'is-online' });
  });

  it('accepts a URL without a protocol', () => {
    expect(parseGitHubRepo('github.com/sindresorhus/is-online')).toEqual({
      owner: 'sindresorhus',
      repo: 'is-online',
    });
  });

  it('accepts a www host and a trailing slash', () => {
    expect(parseGitHubRepo('http://www.github.com/owner/repo/')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('ignores query strings and fragments', () => {
    expect(parseGitHubRepo('https://github.com/owner/repo?tab=readme#top')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('throws for a URL missing the repository segment', () => {
    expect(() => parseGitHubRepo('https://github.com/owner')).toThrow(GeminiError);
    expect(() => parseGitHubRepo('https://github.com/')).toThrow('Invalid GitHub repository URL');
  });
});

describe('isGitHubRepoUrl', () => {
  it('detects owner/repo GitHub URLs', () => {
    expect(isGitHubRepoUrl('https://github.com/sindresorhus/is-online')).toBe(true);
    expect(isGitHubRepoUrl('https://github.com/owner/repo/tree/main')).toBe(true);
    expect(isGitHubRepoUrl('https://www.github.com/owner/repo')).toBe(true);
  });

  it('rejects non-repo GitHub URLs (need both owner and repo)', () => {
    expect(isGitHubRepoUrl('https://github.com')).toBe(false);
    expect(isGitHubRepoUrl('https://github.com/features')).toBe(false);
  });

  it('rejects non-GitHub URLs', () => {
    expect(isGitHubRepoUrl('https://example.com/owner/repo')).toBe(false);
    expect(isGitHubRepoUrl('https://gitlab.com/owner/repo')).toBe(false);
    expect(isGitHubRepoUrl('not-a-url')).toBe(false);
  });
});

describe('fetchGitHubRepo', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchImageAsBase64).mockResolvedValue({
      base64: 'aW1hZ2VieXRlcw==',
      mimeType: 'image/png',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('merges repo metadata, README, and package.json into PreparedContent', async () => {
    global.fetch = mockGitHubFetch();

    const content = await fetchGitHubRepo('https://github.com/sindresorhus/is-online');

    expect(content.title).toBe('is-online');
    expect(content.description).toBe('Check if the internet connection is up');
    // README text is merged in.
    expect(content.textContent).toContain('Check if the internet connection is up');
    // Package metadata (keywords) is merged in.
    expect(content.textContent).toContain('connectivity');
    // Repo topics are merged in.
    expect(content.textContent.toLowerCase()).toContain('online');
    // Source label names the input type for the shared prompt preamble.
    expect(content.sourceLabel).toContain('GitHub repository');
    expect(content.sourceLabel).toContain('sindresorhus/is-online');
  });

  it('resolves relative README images to raw.githubusercontent.com and keeps absolute ones', async () => {
    global.fetch = mockGitHubFetch();

    await fetchGitHubRepo('https://github.com/sindresorhus/is-online');

    const fetchedUrls = vi.mocked(fetchImageAsBase64).mock.calls.map((c) => c[0]);
    // Relative path resolved against the default branch.
    expect(fetchedUrls).toContain(
      'https://raw.githubusercontent.com/sindresorhus/is-online/main/media/screenshot.png'
    );
    // Absolute image URL kept as-is.
    expect(fetchedUrls).toContain('https://cdn.example.com/demo.png');
    // SVG logo and shields.io badge are filtered out (not screenshots).
    expect(fetchedUrls.some((u) => u.includes('logo.svg'))).toBe(false);
    expect(fetchedUrls.some((u) => u.includes('shields.io'))).toBe(false);
  });

  it('collects successfully downloaded images as base64 candidates', async () => {
    global.fetch = mockGitHubFetch();

    const content = await fetchGitHubRepo('https://github.com/sindresorhus/is-online');

    expect(content.images.length).toBeGreaterThan(0);
    expect(content.images[0]).toEqual({ base64: 'aW1hZ2VieXRlcw==', mimeType: 'image/png' });
  });

  it('never downloads more than 5 images', async () => {
    const manyImages = Array.from({ length: 12 }, (_, i) => `![shot${i}](media/shot${i}.png)`).join(
      '\n\n'
    );
    global.fetch = mockGitHubFetch({
      '/readme': { ok: true, status: 200, body: { content: b64(manyImages) } },
    });

    await fetchGitHubRepo('https://github.com/sindresorhus/is-online');

    expect(vi.mocked(fetchImageAsBase64).mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('throws a 404 GeminiError when the repository does not exist', async () => {
    global.fetch = mockGitHubFetch({
      [`/repos/${OWNER}/${REPO}`]: {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        body: { message: 'Not Found' },
      },
    });

    await expect(
      fetchGitHubRepo('https://github.com/sindresorhus/is-online')
    ).rejects.toMatchObject({
      name: 'GeminiError',
      statusCode: 404,
    });
    await expect(fetchGitHubRepo('https://github.com/sindresorhus/is-online')).rejects.toThrow(
      'Repository not found'
    );
  });

  it('maps a 403 with exhausted rate limit to a 429 GeminiError mentioning GITHUB_TOKEN', async () => {
    global.fetch = mockGitHubFetch({
      [`/repos/${OWNER}/${REPO}`]: {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: { 'x-ratelimit-remaining': '0' },
        body: { message: 'API rate limit exceeded' },
      },
    });

    await expect(
      fetchGitHubRepo('https://github.com/sindresorhus/is-online')
    ).rejects.toMatchObject({
      name: 'GeminiError',
      statusCode: 429,
    });
    await expect(fetchGitHubRepo('https://github.com/sindresorhus/is-online')).rejects.toThrow(
      /GITHUB_TOKEN/
    );
  });

  it('sends an Authorization header when a token is provided', async () => {
    const fetchMock = mockGitHubFetch();
    global.fetch = fetchMock;

    await fetchGitHubRepo('https://github.com/sindresorhus/is-online', 'ghp_secrettoken');

    const metadataCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes(`/repos/${OWNER}/${REPO}`)
    );
    expect(metadataCall).toBeDefined();
    const headers = (metadataCall![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ghp_secrettoken');
  });

  it('omits the Authorization header when no token is available', async () => {
    const fetchMock = mockGitHubFetch();
    global.fetch = fetchMock;

    await fetchGitHubRepo('https://github.com/sindresorhus/is-online');

    const metadataCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes(`/repos/${OWNER}/${REPO}`)
    );
    const headers = (metadataCall![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('honors the GITHUB_API_BASE test seam', async () => {
    vi.stubEnv('GITHUB_API_BASE', 'http://127.0.0.1:4545');
    const fetchMock = mockGitHubFetch();
    // Re-route: the seam changes the host, so match on the path only.
    global.fetch = vi.fn((input: string | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      expect(url.startsWith('http://127.0.0.1:4545')).toBe(true);
      return fetchMock(url.replace('http://127.0.0.1:4545', 'https://api.github.com'));
    }) as unknown as typeof fetch;

    const content = await fetchGitHubRepo('https://github.com/sindresorhus/is-online');
    expect(content.title).toBe('is-online');
  });
});
