/**
 * Hermetic upstream stub for E2E / CI.
 *
 * Every server-side upstream the app talks to is pointed here via env seams
 * (`GEMINI_API_BASE`, `POLLINATIONS_API_BASE`, `GITHUB_API_BASE`), so no test
 * ever reaches the live internet. A single tiny HTTP server serves all shapes:
 *
 *  - POST ...:generateContent  -> a Gemini generateContent response whose
 *    candidates[0].content.parts carries BOTH a text part (a valid
 *    GeminiAnalysisResult JSON, for the analyze pipeline) AND an inline PNG
 *    part (for the Imagen image pipeline). The fetch client appends
 *    /models/<m>:generateContent; the @google/genai SDK inserts a version
 *    segment (/v1beta/models/<m>:generateContent) - matching on the
 *    :generateContent suffix covers both.
 *  - GET  a "/models" path     -> a canned model list including gemini-flash-latest.
 *  - GET  /repos/...           -> GitHub REST metadata + README (base64).
 *  - Any other GET             -> a small valid PNG. This covers BOTH
 *    Pollinations path shapes: /prompt/<encoded>?... (base ends in /prompt)
 *    and /<encoded>?... (origin-style base).
 *
 * The PNG is fabricated once with sharp at startup so it is guaranteed decodable
 * by the routes' `normalizeImage` (a hand-typed base64 constant risks a subtly
 * invalid stream that sharp rejects).
 */

import http from 'node:http';
import sharp from 'sharp';

/** A canned, Shopify-valid analysis result the analyze pipeline can parse. */
const ANALYSIS_RESULT = {
  appName: 'Stub Analyzed App',
  appIntroduction: 'A hermetic stub tagline for E2E runs',
  appDescription:
    'This analysis result is served by the local E2E stub so the app never touches a live model. It exercises the full analyze pipeline deterministically.',
  featureList: ['Deterministic testing', 'Offline analysis', 'Fast feedback'],
  languages: ['en'],
  primaryCategory: 'Store design',
  featureTags: ['testing', 'automation', 'ci'],
  pricing: { type: 'free' },
  confidence: 0.91,
};

/** Canned model list. Includes the self-updating alias the resolver prefers. */
const MODEL_LIST = {
  models: [
    {
      name: 'models/gemini-flash-latest',
      displayName: 'Gemini Flash Latest',
      description: 'Self-updating flash alias',
      inputTokenLimit: 1000000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
    },
    {
      name: 'models/gemini-3.5-flash',
      displayName: 'Gemini 3.5 Flash',
      description: 'Pinned fast model',
      inputTokenLimit: 1000000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
    },
    {
      name: 'models/gemini-3.1-flash-image',
      displayName: 'Gemini 3.1 Flash Image',
      description: 'Image generation model',
      inputTokenLimit: 1000000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent'],
    },
  ],
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendPng(res, pngBuffer) {
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': pngBuffer.length,
  });
  res.end(pngBuffer);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Build a Gemini `generateContent` response carrying both a JSON text part and
 * an inline PNG part, so the same handler serves analyze and image generation.
 */
function buildGenerateContentResponse(pngBase64) {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [
            { text: JSON.stringify(ANALYSIS_RESULT) },
            { inlineData: { mimeType: 'image/png', data: pngBase64 } },
          ],
        },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 200,
      totalTokenCount: 300,
    },
  };
}

/** GitHub REST metadata for any `/repos/{owner}/{repo}` request. */
function githubRepoMetadata(owner, repo) {
  return {
    id: 1,
    name: repo,
    full_name: `${owner}/${repo}`,
    description: `Stub repository ${owner}/${repo} for hermetic E2E`,
    html_url: `https://github.com/${owner}/${repo}`,
    homepage: '',
    language: 'TypeScript',
    topics: ['shopify', 'app'],
    default_branch: 'main',
    stargazers_count: 42,
  };
}

/** README markdown (no image refs, so no live raw.githubusercontent fetch). */
const GITHUB_README = `# Stub App\n\nA deterministic README served by the E2E stub. It describes a Shopify app with several capabilities so the analysis pipeline has real text to work with. Features include inventory sync, automated reports, and multi-language support.\n`;

export async function startStubServer(port = 4545) {
  // Fabricate one guaranteed-valid PNG up front (decodable by sharp/normalizeImage).
  const pngBuffer = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 90, g: 140, b: 210 } },
  })
    .png()
    .toBuffer();
  const pngBase64 = pngBuffer.toString('base64');

  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method || 'GET').toUpperCase();
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const pathname = url.pathname;

      // Gemini generateContent (text analysis AND image generation).
      if (pathname.endsWith(':generateContent') || pathname.includes(':generateContent')) {
        await readBody(req); // drain
        return sendJson(res, 200, buildGenerateContentResponse(pngBase64));
      }

      // Gemini streaming (defensive — SSE). Not used by analyze, but safe.
      if (pathname.includes(':streamGenerateContent')) {
        await readBody(req);
        const chunk = `data: ${JSON.stringify(buildGenerateContentResponse(pngBase64))}\n\n`;
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        return res.end(chunk);
      }

      // Gemini model list.
      if (method === 'GET' && pathname.endsWith('/models')) {
        return sendJson(res, 200, MODEL_LIST);
      }

      // GitHub REST API.
      if (method === 'GET' && pathname.startsWith('/repos/')) {
        const parts = pathname.split('/').filter(Boolean); // ['repos', owner, repo, ...]
        const owner = parts[1];
        const repo = parts[2];
        const tail = parts.slice(3).join('/');

        if (tail === 'readme') {
          return sendJson(res, 200, {
            name: 'README.md',
            path: 'README.md',
            encoding: 'base64',
            content: Buffer.from(GITHUB_README, 'utf8').toString('base64'),
          });
        }

        // package.json / shopify.app.toml probes → 404 (fetcher tolerates).
        if (tail.startsWith('contents/')) {
          return sendJson(res, 404, { message: 'Not Found' });
        }

        if (owner && repo) {
          return sendJson(res, 200, githubRepoMetadata(owner, repo));
        }
      }

      // Fallback: any other GET returns the PNG. Covers both Pollinations path
      // shapes (`/prompt/<enc>?…` and `/<enc>?…`).
      if (method === 'GET') {
        return sendPng(res, pngBuffer);
      }

      return sendJson(res, 404, { error: 'stub: unhandled route', method, pathname });
    } catch (err) {
      return sendJson(res, 500, { error: `stub error: ${err?.message || 'unknown'}` });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  // eslint-disable-next-line no-console
  console.log(`[e2e-stub] listening on http://127.0.0.1:${port}`);

  return {
    server,
    async close() {
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    },
  };
}

// This file is the stub process: global-setup spawns it as `node stub-server.mjs`
// (and it can be run standalone for manual debugging). Start on load.
startStubServer(Number(process.env.STUB_PORT) || 4545).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[e2e-stub] failed to start:', err);
  process.exit(1);
});
