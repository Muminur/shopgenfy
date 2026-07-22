# API Documentation

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.vercel.app/api`

## Authentication

There is no login/session system. Routes that persist per-user state (`/api/submissions*`, `/api/settings`) require an `x-user-id` header identifying an anonymous client — the frontend generates and stores a `user-<uuid>` value in `localStorage` and attaches it automatically via the `apiFetch` helper (`src/lib/api-client.ts`). Missing the header on those routes returns `401`. A well-formed id is upserted on first use, so it never 404s.

All other routes (`/api/gemini/*`, `/api/analyze/source`, `/api/imagen/generate`, `/api/nanobanana/generate`, `/api/images*`, `/api/screenshots/upload`, `/api/export`) require no auth — image ids are unguessable UUIDs, which is what makes `GET /api/images/[id]` safe to leave unauthenticated (same rationale as a CDN URL).

## Rate Limiting

Endpoints are rate-limited per client IP (sliding window):

| Endpoint | Limit |
|----------|-------|
| `GET /api/gemini/models` | 30 requests/minute |
| `POST /api/gemini/analyze` | 10 requests/minute |
| `POST /api/analyze/source` | 5 requests/minute (shares the generation limiter — extraction + a model call is expensive) |
| `POST /api/nanobanana/generate` | 5 requests/minute |
| `POST /api/imagen/generate` | 5 requests/minute |
| `POST /api/nanobanana/batch` | 2 requests/minute |
| `POST /api/screenshots/upload` | 20 requests/minute (sized for a full folder-upload batch) |
| `POST /api/export` | 10 requests/minute |

`GET/POST /api/images*` is not rate-limited (cheap metadata/byte reads keyed on unguessable ids).

Rate limit headers are included on limited responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds until the next request is allowed (only on `429`)

---

## Endpoints

### Health Check

#### GET /api/health

Checks the API and database connection. **Requires the database** — returns `503` whenever it's unreachable, even though the core analyze/generate/export flow does not need it.

**Response**
```json
{
  "status": "healthy",
  "timestamp": "2026-07-21T10:00:00.000Z",
  "version": "0.1.0",
  "environment": "production",
  "uptime": 3600,
  "services": {
    "database": "connected",
    "api": "operational"
  }
}
```

**Status Codes**
- `200`: Healthy (database connected)
- `503`: Unhealthy (database connection failed)

---

### API Status

#### GET /api/status

Live-probes the Gemini and Pollinations upstreams and reports connectivity/latency. Always returns `200` (a probe failure is reported inside the body, not as an HTTP error) unless the handler itself throws.

**Response**
```json
{
  "gemini": { "connected": true, "latency": 150 },
  "pollinations": { "connected": true, "latency": 80 }
}
```

A disconnected upstream reports `"connected": false` with an `"error"` string instead of `"latency"`.

#### GET /api/status/versions

Best-effort version info. Pollinations has a static version string; the Gemini entry is only populated when the database has a tracked record (missing/unreachable DB silently falls back to `null`, not an error). Always returns `200`.

**Response**
```json
{
  "gemini": { "version": null, "lastChecked": "2026-07-21T10:00:00.000Z" },
  "pollinations": { "version": "1.0.0", "lastChecked": "2026-07-21T10:00:00.000Z" }
}
```

---

### Gemini AI

#### GET /api/gemini/models

Lists models currently available from the configured Gemini API key (live upstream call, cached for 1 hour). `filter` is an optional substring query param.

**Response**
```json
{
  "models": [
    {
      "name": "models/gemini-flash-latest",
      "displayName": "Gemini Flash (latest)",
      "description": "Fast, self-updating alias for the current flash model",
      "inputTokenLimit": 1000000,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": ["generateContent"]
    }
  ]
}
```

**Errors**: `500` if `GEMINI_API_KEY` is not configured or the upstream call fails.

#### POST /api/gemini/analyze

Analyzes a website URL or a GitHub repository link and extracts Shopify listing fields. GitHub URLs (`github.com/{owner}/{repo}`) are auto-detected; `sourceType` can also force the path explicitly.

**Request Body**
```json
{
  "url": "https://example.com/my-app",
  "sourceType": "url",
  "model": "gemini-flash-latest"
}
```

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `url` | string | Yes | Website URL, or a `github.com/{owner}/{repo}` link |
| `sourceType` | `'url' \| 'github' \| 'source'` | No | Forces the input path; auto-detected from the URL shape when omitted |
| `model` | string | No | Preferred Gemini text model; falls back through the resolver chain if unavailable |

**Response** — the analysis object is returned directly (no `success`/`data` wrapper):
```json
{
  "appName": "My Amazing App",
  "appIntroduction": "The best app for productivity",
  "appDescription": "A comprehensive description of the app...",
  "featureList": ["Feature 1 description", "Feature 2 description"],
  "languages": ["en"],
  "primaryCategory": "Store design",
  "featureTags": ["automation", "workflow"],
  "pricing": { "type": "free" },
  "confidence": 0.9,
  "screenshots": [{ "base64": "...", "mimeType": "image/png" }],
  "warnings": []
}
```

`primaryCategory` is fuzzy-matched against the official Shopify category list (exact, case-insensitive, then prefix match) and comes back as `""` if nothing matches — autofill never poisons the form with an invalid category. `warnings` lists degraded behavior, e.g. a retired model that was skipped in favor of a fallback.

**Error Response**
```json
{ "error": "Repository not found" }
```

**Status codes**: `400` bad input (missing/invalid URL), `404` GitHub repo not found, `429` GitHub rate limit exceeded (set `GITHUB_TOKEN`) or the endpoint's own rate limiter, `503` `GEMINI_API_KEY` not configured, `502`/`500` upstream failure.

#### POST /api/analyze/source

Analyzes a pasted README/description or an uploaded zip archive (Local Source tab) using the same extraction → analysis pipeline as the URL/GitHub paths.

**Request** — either:
- `multipart/form-data` with a `file` field (zip, ≤30 MB) and optional `model` field, or
- JSON body `{ "text": "...", "model": "gemini-flash-latest" }`

The zip path guards against decompression bombs before extracting anything: ≤30 MB compressed, ≤100 MB declared uncompressed, ≤2,000 entries, ≤20 MB per entry. Only `README*`, `docs/**/*.md`, `package.json`, and `shopify.app.toml` are read (redacted for secret-looking lines, capped at 12,000 characters); up to 10 image files are harvested as screenshot candidates.

**Response**: the same `GeminiAnalysisResult` shape as `/api/gemini/analyze`.

**Status codes**: `400` no file/text, oversized upload, malformed zip, zip-bomb guard tripped (`code: 'ZIP_BOMB'` or `'INVALID_ZIP'`), or too little extractable text; `503` `GEMINI_API_KEY` not configured.

---

### Image Generation

#### POST /api/nanobanana/generate

Generates a single image via the free Pollinations.ai path. The raw bytes are normalized to the exact Shopify spec and served from the in-process image store — the response never contains a `data:` URI or a third-party hotlink.

**Request Body**
```json
{
  "type": "feature",
  "prompt": "A modern dashboard showing analytics",
  "style": "modern",
  "featureHighlight": "Real-time analytics",
  "submissionId": "optional-submission-id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `type` | `'icon' \| 'feature'` | Yes | Target spec: icon → 1200×1200, feature → 1600×900 |
| `prompt` | string | Yes | Image generation prompt |
| `style` | `'flat' \| 'modern' \| 'gradient' \| 'minimalist' \| '3d'` | No | Style hint |
| `featureHighlight` | string | No | Used as alt text / feature label |
| `negativePrompt` | string | No | Content to avoid |
| `submissionId` | string | No | Associates the stored image with a submission for later listing/export |

**Response**
```json
{
  "image": {
    "id": "3f2a...uuid",
    "url": "/api/images/3f2a...uuid",
    "width": 1600,
    "height": 900,
    "type": "feature",
    "altText": "Real-time analytics",
    "provider": "pollinations",
    "featureText": "Real-time analytics",
    "createdAt": 1753000000000
  },
  "jobId": "job_123",
  "status": "completed",
  "warnings": ["Prompt-only feature image generated without real app screenshots; may not satisfy Shopify listing rule 4.4.4."]
}
```

Pollinations has no screenshot-reference capability, so every `feature`-type image it generates is prompt-only — the compliance warning above is therefore always present for `type: "feature"`. Icon requests are exempt (4.4.4 concerns listing/feature imagery, not the app icon) and always return `warnings: []`.

**Status codes**: `400` invalid body, `502` upstream/normalization failure, `500` other failure.

#### POST /api/imagen/generate

Generates icon and/or feature image(s) via the Gemini image-model path (`resolveImageModel()`), optionally referencing real screenshots. Every returned image is normalized and stored the same way as the Pollinations path.

**Request Body**
```json
{
  "type": "all",
  "appName": "My Amazing App",
  "appDescription": "A comprehensive description",
  "features": ["Real-time analytics", "One-click export"],
  "screenshots": [{ "base64": "...", "mimeType": "image/png" }],
  "submissionId": "optional-submission-id"
}
```

`type` is `'icon' | 'feature' | 'all'`. `featureText` is required when `type` is `'feature'`; `features` (non-empty) is required when `type` is `'all'`.

**Response (`type: 'all'`)**
```json
{
  "success": true,
  "images": [{ "id": "...", "url": "/api/images/...", "width": 1200, "height": 1200, "type": "icon", "provider": "gemini", "...": "..." }],
  "count": 3,
  "usedScreenshots": 2,
  "warnings": ["Prompt-only feature image generated without real app screenshots; may not satisfy Shopify listing rule 4.4.4."],
  "specs": { "icon": { "width": 1200, "height": 1200 }, "feature": { "width": 1600, "height": 900 } }
}
```

A `warnings` entry is appended whenever a feature image was generated prompt-only (no screenshot reference actually used), per the fallback-must-be-visible policy.

**Status codes**: `400` invalid body, `502` upstream or normalization failure (`ImageNormalizeError`/`ImagenError` with `code: 'UPSTREAM'`), `503` `GEMINI_API_KEY` not configured.

#### POST /api/screenshots/upload

Uploads a real screenshot (folder mode, or a screenshot harvested from an analyzed source) and normalizes/stores it directly — **no AI involved**. This is the primary Shopify 4.4.4 compliance path.

**Request** — `multipart/form-data`:

| Field | Required | Description |
|-------|----------|--------------|
| `file` | Yes | PNG/JPEG/WebP, ≤10 MB |
| `kind` | Yes | `'icon'` or `'feature'` |
| `submissionId` | No | Associates the image with a submission |
| `altText` | No | Defaults to `"Uploaded app icon"` / `"Uploaded screenshot"` |

**Response**
```json
{ "image": { "id": "...", "url": "/api/images/...", "width": 1600, "height": 900, "type": "feature", "provider": "upload", "...": "..." } }
```

**Status codes**: `400` missing/wrong-type/oversized file, invalid `kind`, or a decode failure (`code: 'BAD_INPUT'` / `'TOO_LARGE'`).

#### POST /api/nanobanana/batch

Generates icon + feature images for a **saved** submission (reads it from the database) via Pollinations and persists results to `generated_images`. Requires the database.

**Request Body**
```json
{ "submissionId": "654f1e2a9c1234567890abcd" }
```

**Response**
```json
{
  "success": true,
  "submissionId": "654f1e2a9c1234567890abcd",
  "images": [
    { "id": "...", "type": "icon", "jobId": "job_1", "status": "completed", "imageUrl": "...", "width": 1200, "height": 1200 },
    { "type": "feature", "jobId": "job_2", "status": "failed", "width": 1600, "height": 900, "featureHighlighted": "Feature 1" }
  ],
  "totalGenerated": 2
}
```

**Status codes**: `400` invalid/missing `submissionId`, `404` submission not found, `500`/`502` generation failure.

#### GET /api/images

Lists stored image metadata (no bytes) for one submission.

**Query Parameters**: `submissionId` (**required** — the route never enumerates the whole store, to prevent one client from listing another's images)

**Response**
```json
{ "images": [{ "id": "...", "url": "/api/images/...", "width": 1200, "height": 1200, "type": "icon", "provider": "gemini", "createdAt": 1753000000000 }] }
```

**Status codes**: `200` (possibly empty array), `400` missing/blank `submissionId`.

#### GET /api/images/[id]

Serves the raw normalized PNG bytes for a stored image. Ids are unguessable UUIDs, so this route is intentionally unauthenticated.

**Response**: `image/png` bytes, `Cache-Control: private, max-age=86400`.

**Status codes**: `200` found, `404` unknown/expired/evicted id.

> The image store is an in-process, bounded LRU cache (≤200 entries, ≤500 MB, 24h TTL) — on serverless deployments it is **per-instance**, so an id minted on one instance may 404 on another. This is documented, expected behavior for a local-first tool; see [Database-Optional Operation](../README.md#database-optional-operation).

---

### Submissions

#### GET /api/submissions

List submissions for the current user (`x-user-id` header required).

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page (max 100) |

**Response**
```json
{
  "submissions": [
    {
      "_id": "654f1e2a9c1234567890abcd",
      "userId": "user-...",
      "appName": "My App",
      "status": "draft",
      "createdAt": "2026-07-21T10:00:00.000Z",
      "updatedAt": "2026-07-21T10:30:00.000Z"
    }
  ],
  "total": 25
}
```

#### POST /api/submissions

Create a new submission (`status` always starts as `'draft'`). The dashboard's `features` field is auto-mapped to `featureList` server-side.

**Request Body**
```json
{
  "appName": "My Amazing App",
  "appIntroduction": "Short tagline",
  "appDescription": "Full description...",
  "featureList": ["Feature 1", "Feature 2"],
  "languages": ["en"],
  "worksWith": ["Online Store 2.0"],
  "primaryCategory": "Store design",
  "featureTags": ["responsive", "customizable"],
  "landingPageUrl": "https://example.com"
}
```

**Validation Rules**
| Field | Max Length | Notes |
|-------|------------|-------|
| appName | 30 chars | |
| appIntroduction | 100 chars | |
| appDescription | 500 chars | No contact info, no unverifiable claims |
| featureList | 80 chars each | |
| worksWith | 6 items max | |
| featureTags | 25 items max | |

`primaryCategory` and `landingPageUrl` are optional at creation (draft mode allows an incomplete form).

**Response** — the created submission document directly, `201`:
```json
{ "_id": "654f1e2a9c1234567890abcd", "userId": "user-...", "appName": "My Amazing App", "status": "draft", "createdAt": "...", "updatedAt": "..." }
```

#### GET /api/submissions/[id]

Get a single submission. `403` if it belongs to a different `x-user-id`.

**Response**: the submission document (same shape as POST's response), `200`.

#### PUT /api/submissions/[id]

Update an existing submission. All fields optional (partial update). Returns the updated document, `200`.

#### DELETE /api/submissions/[id]

Delete a submission. Returns `204 No Content` (no body).

---

### Settings

#### GET /api/settings

Get user preferences (`x-user-id` header required). Upserts on first access — never `404`s for a well-formed id.

**Response**
```json
{
  "selectedGeminiModel": "auto",
  "theme": "system",
  "autoSave": true,
  "screenshotSource": "website"
}
```

`selectedGeminiModel` defaults to `"auto"` (resolver decides); `screenshotSource` is one of `'website' | 'repo' | 'folder'`.

#### PUT /api/settings

Update user preferences. Any subset of `selectedGeminiModel`, `theme`, `autoSave`, `screenshotSource` may be sent.

**Request Body**
```json
{ "selectedGeminiModel": "gemini-flash-latest", "theme": "dark", "screenshotSource": "repo" }
```

**Response**: the updated preferences, same shape as GET.

**Status codes**: `401` missing `x-user-id`, `400` invalid `theme`/`screenshotSource`, `503` database unavailable.

---

### Export

#### POST /api/export

**Stateless** export — works with the database down. Accepts the current form state plus the ids of already-normalized images held in the image store, and streams back a ZIP.

**Request Body**
```json
{
  "submission": {
    "appName": "My App",
    "appIntroduction": "Tagline",
    "appDescription": "Description",
    "features": ["Feature 1", "Feature 2"],
    "primaryCategory": "Store design"
  },
  "imageIds": ["3f2a...uuid", "9b1c...uuid"]
}
```

**Response**: `application/zip` binary containing:
- `metadata.json` — submission data, resolved image list, `missingImages` (ids not found in the store — non-fatal), and a Shopify-compliance summary
- `README.txt` — submission checklist and instructions
- `images/icon.png`, `images/feature-1.png`, `images/feature-2.png`, … — real PNG bytes pulled from the image store

Ids that no longer resolve in the store (e.g. a fresh serverless instance) are listed in `metadata.json.missingImages` rather than failing the export.

#### GET /api/export/[id]

**Database-backed** export for a saved submission (looks the submission up by ObjectId, embeds any matching images still held in the image store).

**Response**: `application/zip` binary — same `metadata.json` / `README.txt` / `images/*.png` layout as the stateless export, plus `images/manifest.json`.

**Status codes**: `400` invalid id format, `404` submission not found, `500` archive generation failure.

---

## Error Handling

Most errors follow:

```json
{ "error": "Human-readable description" }
```

Some routes add a machine-readable `code` (e.g. `'TOO_LARGE'`, `'ZIP_BOMB'`, `'INVALID_ZIP'`, `'BAD_INPUT'`, `'UPSTREAM'`) for programmatic handling.

### Common Status Codes

| Code | Description |
|------|--------------|
| 200 | Success |
| 201 | Created |
| 204 | No content (delete) |
| 400 | Bad Request - invalid input |
| 401 | Unauthorized - missing `x-user-id` |
| 403 | Forbidden - resource belongs to another user |
| 404 | Not Found |
| 429 | Too Many Requests - rate limited, or GitHub rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Bad Gateway - upstream (Gemini/Pollinations/GitHub) failure |
| 503 | Service Unavailable - required key/database not configured or unreachable |

---

## TypeScript Types

Request/response types are available in `src/types/index.ts`, `src/lib/gemini.ts` (`GeminiAnalysisResult`), `src/lib/image-store.ts` (`StoredImage`), and `src/lib/validators/submission.ts` / `src/lib/validators/user.ts`.

```typescript
import type { Submission, User } from '@/types';
import type { GeminiAnalysisResult } from '@/lib/gemini';
import type { StoredImage } from '@/lib/image-store';
```
