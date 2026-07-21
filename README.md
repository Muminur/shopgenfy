# Shopify App Store Submission Assistant

An AI-powered web application that helps developers prepare and submit apps to the Shopify App Store — turn a website URL, a GitHub repository, or your own local source code into complete, compliant listing details and images.

## Features

- **Three input sources** - Analyze your app from its **Website URL**, a **GitHub Repo** link, or **Local Source** (paste a README or upload a zip). All three feed the same auto-fill pipeline.
- **Self-healing AI analysis** - Google Gemini extracts app name, tagline, description, features, and category. Text models are resolved dynamically with a verified fallback chain, so a retired model ID no longer breaks the whole app.
- **Screenshot Source setting** - Choose in Settings whether feature images should be sourced from the analyzed **website**, the **GitHub repo**, or your own uploaded **folder**.
- **Spec-exact image normalization** - Every image — AI-generated or a real screenshot — is automatically resized/cropped to the exact Shopify spec (1200×1200 icon, 1600×900 feature, PNG) via a sharp-based normalizer. No more mislabeled dimensions or wrong formats.
- **Two image-generation paths** - The free, keyless **Pollinations.ai** path, and a premium **Gemini image model** path that can reference real screenshots.
- **Real-screenshot-first compliance** - Real UI screenshots are used directly as feature images (Shopify listing rule 4.4.4); prompt-only AI generation is a fallback and always surfaces a compliance warning in the response.
- **Content validation** - Validates all content against Shopify's App Store character limits and content rules.
- **Stateless export** - Download a ready-to-submit ZIP (metadata + real PNG images) that works even when the database is unreachable.
- **Database-optional** - MongoDB persists submissions and settings when available, but analysis, image generation, and export all work without it.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes |
| AI (text analysis) | Google Gemini API (`@google/genai`) |
| AI (image generation) | Gemini image models + Pollinations.ai (free, keyless) |
| Image normalization | sharp |
| Database | MongoDB (optional — see [Database-Optional Operation](#database-optional-operation)) |
| File Storage | Google Drive API (optional) |
| Deployment | Vercel |

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))
- MongoDB (optional — local or Atlas; the app runs without it)

### Installation

```bash
# Clone the repository
git clone https://github.com/Muminur/shopgenfy.git
cd shopgenfy

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables (see below)

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file (see `.env.example`).

### Required

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key. Powers analysis and the Gemini image-generation path. Without it, analyze/imagen routes return `503`. |

### Recommended

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token. Raises the GitHub REST API limit from 60 req/hour (unauthenticated, per IP) to 5,000 req/hour when analyzing a repository via the **GitHub Repo** tab. |

### Optional — Database

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string. Leave unset to run fully DB-optional — analysis, image generation, and stateless export (`POST /api/export`) all work without it. Persistence (saved submissions, settings, `/api/health`, `GET /api/export/[id]`) requires it. |
| `MONGODB_DB_NAME` | Database name. |

### Optional — Google Drive (unused by the core flow)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `GOOGLE_DRIVE_FOLDER_ID` | Destination folder for Drive exports. |
| `GOOGLE_REFRESH_TOKEN` | OAuth refresh token. |

### Optional — Advanced overrides

These are not required for normal use; they exist mainly as test seams for hermetic CI, but are also useful for pinning a specific model or self-hosting a compatible endpoint.

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_TEXT_MODEL` | Preferred text-analysis model, tried before the built-in fallback chain (`gemini-flash-latest` → `gemini-3.5-flash`). | unset |
| `GEMINI_IMAGE_MODEL` | Preferred image-generation model, tried before the built-in fallback chain (`gemini-3.1-flash-image` → `gemini-3-pro-image`). | unset |
| `GEMINI_API_BASE` | Base URL for the Gemini REST/SDK calls. | `https://generativelanguage.googleapis.com/v1beta` |
| `POLLINATIONS_API_BASE` | Base URL for the free image-generation backend. | `https://image.pollinations.ai/prompt` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployment. | unset |

### Legacy / unused

`NANO_BANANA_API_KEY` is no longer read anywhere — Pollinations.ai generates images without any key. Any leftover value in your `.env.local` is harmless and can be deleted.

### Getting API Keys

1. **Google Gemini API**: https://aistudio.google.com/app/apikey
2. **GitHub token** (optional, recommended for the GitHub Repo tab): https://github.com/settings/tokens (no scopes needed — public repo reads only)
3. **MongoDB Atlas** (optional): https://cloud.mongodb.com
4. **Google Drive API** (optional): https://console.cloud.google.com (enable Drive API, create OAuth credentials)

## Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm run test         # Run unit/integration tests (watch mode)
npm run test:run     # Run unit/integration tests once
npm run test:e2e     # Run Playwright E2E tests
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # TypeScript type checking
npm run format       # Format code with Prettier
npm run format:check # Check formatting
```

## Project Structure

```
shopgenfy/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── gemini/        # Gemini analyze/models endpoints
│   │   │   ├── analyze/source # Local-source (zip/paste) analysis
│   │   │   ├── nanobanana/    # Free (Pollinations) image generation
│   │   │   ├── imagen/        # Premium (Gemini) image generation
│   │   │   ├── images/        # Normalized image store (GET list + bytes)
│   │   │   ├── screenshots/   # Direct screenshot upload (no AI)
│   │   │   ├── submissions/   # Submission CRUD
│   │   │   ├── settings/      # User settings (incl. screenshot source)
│   │   │   ├── export/        # Stateless + DB-backed export
│   │   │   ├── health/        # Health check
│   │   │   └── status/        # API status
│   │   ├── dashboard/         # Dashboard page (3-tab input source)
│   │   ├── settings/          # Settings page
│   │   └── preview/           # Preview page
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── forms/            # Form components (incl. ScreenshotDropzone)
│   │   ├── images/           # Image components
│   │   ├── feedback/         # Feedback components
│   │   └── a11y/             # Accessibility components
│   ├── lib/                   # Utilities and services
│   │   ├── model-resolver.ts # Dynamic Gemini model resolution + fallback
│   │   ├── image-normalizer.ts # sharp-based Shopify spec normalizer
│   │   ├── image-store.ts    # Bounded in-process image store
│   │   ├── github-fetcher.ts # GitHub repo -> PreparedContent
│   │   ├── source-extractor.ts # Zip/paste -> PreparedContent
│   │   ├── api-client.ts     # Client-side fetch wrapper (x-user-id)
│   │   ├── db/                # Database operations
│   │   ├── middleware/        # API middleware (rate limiting)
│   │   └── validators/        # Zod validation schemas
│   ├── hooks/                 # Custom React hooks
│   └── types/                 # TypeScript types
├── __tests__/                  # Test files
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── e2e/                   # E2E tests (Playwright, hermetic stub server)
├── public/                     # Static assets
└── docs/                       # Documentation
```

## API Endpoints

See [docs/API.md](docs/API.md) for full request/response documentation.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gemini/models` | GET | List available Gemini models |
| `/api/gemini/analyze` | POST | Analyze a website URL or GitHub repo (`sourceType`) |
| `/api/analyze/source` | POST | Analyze pasted text or an uploaded zip (Local Source) |
| `/api/nanobanana/generate` | POST | Generate an image via the free Pollinations path |
| `/api/nanobanana/batch` | POST | Generate icon + feature images for a saved submission |
| `/api/imagen/generate` | POST | Generate image(s) via the Gemini image-model path |
| `/api/screenshots/upload` | POST | Upload a real screenshot; normalized and stored directly (no AI) |
| `/api/images` | GET | List stored image metadata, optionally by `submissionId` |
| `/api/images/[id]` | GET | Serve a stored image's PNG bytes |
| `/api/submissions` | GET/POST | List/Create submissions |
| `/api/submissions/[id]` | GET/PUT/DELETE | Manage a submission |
| `/api/settings` | GET/PUT | User preferences (incl. `screenshotSource`) |
| `/api/export` | POST | Stateless export — submission + image ids → ZIP (works with DB down) |
| `/api/export/[id]` | GET | DB-backed export for a saved submission |
| `/api/health` | GET | Health check |
| `/api/status` | GET | API status |

## Shopify Compliance

This app enforces Shopify App Store guidelines:

### Content Limits
- App Name: Max 30 characters
- App Introduction: Max 100 characters
- App Description: Max 500 characters
- Feature List: Each item max 80 characters
- Works With: Max 6 items
- Feature Tags: Max 25 items

### Image Specifications

Every image — generated or a user/repo/website screenshot — is automatically normalized to these exact specs before it is served or exported:

- App Icon: **exactly** 1200×1200px PNG (square, no text)
- Feature Images: **exactly** 1600×900px PNG (16:9)
- No Shopify branding
- No PII in images
- ~100px safe zone from edges
- Real UI screenshots take priority over prompt-only AI art (Shopify listing rule 4.4.4); prompt-only fallback images surface a compliance warning

## Database-Optional Operation

The configured MongoDB instance can be down or unset and the core flow still works:

- Analyzing a URL, GitHub repo, or local source (`/api/gemini/analyze`, `/api/analyze/source`) never touches the database.
- Generating and normalizing images (`/api/nanobanana/generate`, `/api/imagen/generate`, `/api/screenshots/upload`) writes to an in-process image store, not the database.
- `POST /api/export` builds the submission ZIP statelessly from the request body and the image store — no database required.
- Routes that persist state (`/api/submissions*`, `/api/settings`, `/api/health`, `GET /api/export/[id]`) require the database and return `503` when it is unreachable; the settings page falls back to `localStorage` in that case.

## Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run specific test file
npm run test -- path/to/test.ts
```

### Test Coverage
- **1,200+ tests** across unit and integration suites (Vitest), plus a hermetic Playwright E2E suite
- **83 Vitest test files** + **13 Playwright E2E specs**
- E2E runs against a local stub upstream server — no live external API calls in CI

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide.

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm run start
```

## Security Features

- Rate limiting on all API endpoints
- Security headers (CSP, XSS protection, etc.)
- Input validation with Zod schemas
- Pre-commit hooks for secret scanning
- Environment variable validation
- SSRF-guarded image fetching for GitHub-referenced screenshots
- Decompression-bomb guards on local-source zip uploads (compressed size, entry count, declared uncompressed size)
- Secret-pattern redaction on text extracted from uploaded/pasted local source

## License

MIT License - see LICENSE file for details.

## Support

- Issues: https://github.com/Muminur/shopgenfy/issues
- Documentation: See `/docs` folder
