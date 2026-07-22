# Deployment Guide

This guide covers deploying the Shopify App Store Submission Assistant to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Vercel Deployment](#vercel-deployment)
3. [Environment Variables](#environment-variables)
4. [Image Pipeline Notes](#image-pipeline-notes)
5. [MongoDB Atlas Setup (Optional)](#mongodb-atlas-setup-optional)
6. [Google Drive API Setup](#google-drive-api-setup)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account with repository access
- [ ] Vercel account (free tier is sufficient)
- [ ] Google Cloud Console account (for Gemini API)
- [ ] (Optional) MongoDB Atlas account — the app is database-optional; see [Database-Optional Operation](../README.md#database-optional-operation)
- [ ] (Optional) Google Cloud Console project for Drive API
- [ ] (Optional) GitHub personal access token for higher-throughput GitHub-repo analysis

---

## Vercel Deployment

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository: `Muminur/shopgenfy`
4. Vercel will auto-detect Next.js configuration

### Step 2: Configure Build Settings

Vercel should auto-detect these settings:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

### Step 3: Configure Environment Variables

Add all required environment variables (see [Environment Variables](#environment-variables) section).

### Step 4: Deploy

1. Click "Deploy"
2. Wait for the build to complete (~2-3 minutes)
3. Your app will be available at `https://your-project.vercel.app`

### Step 5: Configure Custom Domain (Optional)

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL is automatically provisioned

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSy...` |

### Recommended Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | Raises the GitHub API limit from 60 req/hour to 5,000 req/hour when analyzing a repo via the GitHub Repo tab | `ghp_...` |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string. Unset = database-optional mode (analysis, image generation, and `POST /api/export` still work; persistence/health/settings routes return `503`) | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `MONGODB_DB_NAME` | Database name | `shopgenfy_production` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder for exports | `1ABC...` |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth refresh token | `1//0...` |
| `NEXT_PUBLIC_APP_URL` | Public URL of your app | `https://shopgenfy.vercel.app` |
| `SENTRY_DSN` | Sentry error tracking DSN | `https://...@sentry.io/...` |
| `GEMINI_TEXT_MODEL` | Pin a text-analysis model ahead of the built-in fallback chain | `gemini-flash-latest` |
| `GEMINI_IMAGE_MODEL` | Pin an image-generation model ahead of the built-in fallback chain | `gemini-3.1-flash-image` |
| `GEMINI_API_BASE` | Override the Gemini REST/SDK base URL (test seam / self-hosted proxy) | `https://generativelanguage.googleapis.com/v1beta` |
| `POLLINATIONS_API_BASE` | Override the free image-generation backend base URL | `https://image.pollinations.ai/prompt` |

**Legacy**: `NANO_BANANA_API_KEY` is no longer read anywhere — Pollinations.ai is keyless. It is safe to omit.

### Setting Variables in Vercel

1. Go to Project Settings > Environment Variables
2. Add each variable with its value
3. Select environments: Production, Preview, Development
4. Click "Save"

**Security Note**: Never commit `.env` files or expose secrets in client-side code.

---

## Image Pipeline Notes

### sharp native binary

Image normalization (`src/lib/image-normalizer.ts`) uses `sharp`, which ships platform-specific native binaries. The lockfile includes the Linux binaries Vercel's build/runtime environment needs, and CI runs `node -e "require('sharp')"` as a smoke check after `npm ci`. If you deploy from a different build environment, verify `npm ci` pulls a Linux-compatible `@img/sharp-linux-*` package, not just your local platform's.

### In-process image store is per-instance

Generated/uploaded images are normalized and held in an in-process, bounded LRU store (`src/lib/image-store.ts`; ≤200 entries, ≤500 MB, 24h TTL) and served from `/api/images/[id]`. On Vercel's serverless runtime, each function invocation may land on a different instance, so an image id minted on one instance can 404 if a later request is served by another. This is expected for a local-first tool — `POST /api/export` and `GET /api/export/[id]` report unresolvable ids in `metadata.json.missingImages` instead of failing the whole export. If you need images to survive across instances/restarts, persist them externally (e.g. Google Drive, already wired but optional) rather than relying solely on the in-process store.

### Function duration

Several routes declare a longer `maxDuration` via Next.js route segment config, since they call an upstream model or do file I/O:

| Route | `maxDuration` |
|-------|----------------|
| `POST /api/imagen/generate` | 60s |
| `POST /api/analyze/source` | 60s |
| `POST /api/export` | 60s |
| `POST /api/screenshots/upload` | 30s |

Vercel's Hobby plan caps function duration at 60s; Pro raises it to 300s. If you see timeouts on `/api/imagen/generate` or `/api/analyze/source` under Hobby, either upgrade the plan or reduce the work per request (fewer features per `type: 'all'` call, smaller zip uploads).

---

## MongoDB Atlas Setup (Optional)

Skip this section entirely if you want to run database-optional (see [Database-Optional Operation](../README.md#database-optional-operation)): analysis, image generation, and stateless export all work without it. Set it up when you want saved submissions, persisted user settings, and a `healthy` `/api/health` response.

### Step 1: Create Cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a new project
3. Build a new cluster:
   - Choose "Shared" (free) or "Dedicated" for production
   - Select a cloud provider and region close to your Vercel deployment (e.g., AWS us-east-1)
   - Name your cluster

### Step 2: Configure Database Access

1. Go to Database Access
2. Add a database user:
   - Username: `shopgenfy_app`
   - Password: Generate a secure password
   - Role: "Read and write to any database"

### Step 3: Configure Network Access

1. Go to Network Access
2. Add IP Address:
   - For Vercel: Add `0.0.0.0/0` (allow from anywhere)
   - This is necessary because Vercel uses dynamic IPs
   - MongoDB Atlas has built-in DDoS protection

### Step 4: Get Connection String

1. Go to Clusters > Connect
2. Choose "Connect your application"
3. Copy the connection string:
   ```
   mongodb+srv://shopgenfy_app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your database user password
5. Add this as `MONGODB_URI` in Vercel

### Step 5: Create Database Indexes

Connect to your cluster and run:

```javascript
// Submissions collection
db.submissions.createIndex({ userId: 1 });
db.submissions.createIndex({ status: 1 });
db.submissions.createIndex({ createdAt: -1 });

// Generated images collection
db.generated_images.createIndex({ submissionId: 1 });
db.generated_images.createIndex({ type: 1 });

// Users collection
db.users.createIndex({ email: 1 }, { unique: true });

// API versions collection
db.api_versions.createIndex({ service: 1 }, { unique: true });
```

---

## Google Drive API Setup

### Step 1: Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: "Shopgenfy Production"
3. Enable the Google Drive API:
   - Go to APIs & Services > Library
   - Search for "Google Drive API"
   - Click "Enable"

### Step 2: Create OAuth Credentials

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Configure consent screen if prompted
4. Application type: "Web application"
5. Add authorized redirect URIs:
   - `https://your-domain.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for development)
6. Copy the Client ID and Client Secret

### Step 3: Get Refresh Token

Use the OAuth 2.0 Playground to get a refresh token:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the gear icon, enable "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. In Step 1, select "Drive API v3" scopes:
   - `https://www.googleapis.com/auth/drive.file`
5. Authorize and exchange for tokens
6. Copy the refresh token

### Step 4: Create Drive Folder

1. Go to [drive.google.com](https://drive.google.com)
2. Create a new folder: "Shopgenfy Exports"
3. Get the folder ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`

---

## Post-Deployment Verification

### Health Check

After deployment, verify the health endpoint:

```bash
curl https://your-domain.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "api": "operational"
  }
}
```

### Verification Checklist

- [ ] Health endpoint returns `200 OK` (only if `MONGODB_URI` is configured — `/api/health` reports `503` in database-optional deployments even though the core flow works)
- [ ] Landing page loads correctly
- [ ] Dashboard page loads correctly, showing all three input tabs (Website URL / GitHub Repo / Local Source)
- [ ] Settings page shows the model selector (Auto + curated models) and the Screenshot Source card
- [ ] URL analysis works (test with a sample URL)
- [ ] Image generation works (test with a simple prompt) and the returned image loads from `/api/images/[id]`

### Smoke Tests

```bash
# Test health endpoint
curl -s https://your-domain.vercel.app/api/health | jq .status

# Test models endpoint
curl -s https://your-domain.vercel.app/api/gemini/models | jq .models

# Test status endpoint
curl -s https://your-domain.vercel.app/api/status | jq .status
```

---

## Monitoring

### Vercel Analytics

1. Go to Project > Analytics
2. View real-time visitors, page views, and performance metrics

### Vercel Logs

1. Go to Project > Deployments > (select deployment) > Logs
2. View function logs, errors, and requests

### Error Tracking (Sentry)

If you've configured Sentry:

1. Go to [sentry.io](https://sentry.io)
2. View errors, performance issues, and user feedback
3. Set up alerts for critical errors

### Database Monitoring

1. Go to MongoDB Atlas > Clusters > Metrics
2. Monitor connections, operations, and storage
3. Set up alerts for high usage or errors

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Symptoms**: `/api/health` returns `503` with `database: disconnected`; `/api/submissions*` and `/api/settings` return `503`

**Solutions**:
- If you intended to run database-optional, this is expected — analysis, image generation, and `POST /api/export` still work; ignore it
- Otherwise, verify `MONGODB_URI` is correct
- Check MongoDB Atlas Network Access allows `0.0.0.0/0`
- Verify database user credentials
- Check cluster is running and not paused

#### 2. Gemini API Errors

**Symptoms**: URL analysis fails or returns errors

**Solutions**:
- Verify `GEMINI_API_KEY` is valid
- Check API quota in Google Cloud Console
- Verify the model name is correct

#### 3. Image Generation Fails

**Symptoms**: Images don't generate, come back the wrong size, or time out

**Solutions**:
- The free path (`/api/nanobanana/generate`, Pollinations.ai) needs no key but is rate-limited (5 req/min) and can be slow under load
- The premium path (`/api/imagen/generate`) requires a valid `GEMINI_API_KEY` and returns `503` without one
- Every image is normalized to the exact Shopify spec server-side (`src/lib/image-normalizer.ts`); if normalization itself fails (corrupt/undecodable bytes from upstream) the route returns `502`
- Check network connectivity and that the prompt doesn't contain blocked content

#### 4. Function Timeout

**Symptoms**: API requests timeout after 60 seconds

**Solutions**:
- Function timeout is set to 60s (max for Vercel Hobby)
- For longer operations, consider Vercel Pro (300s limit)
- Optimize long-running operations

#### 5. Build Failures

**Symptoms**: Deployment fails during build

**Solutions**:
- Check build logs in Vercel
- Verify all environment variables are set
- Run `npm run build` locally to debug
- Check for TypeScript errors: `npm run type-check`

### Getting Help

- Check [Vercel Documentation](https://vercel.com/docs)
- Check [Next.js Documentation](https://nextjs.org/docs)
- Open an issue on GitHub: https://github.com/Muminur/shopgenfy/issues

---

## Security Checklist

Before going live:

- [ ] All environment variables are set in Vercel (not committed to repo)
- [ ] MongoDB Atlas Network Access is configured (if using MongoDB)
- [ ] Google Drive API is in production mode (not test mode, if using Drive export)
- [ ] Rate limiting is enabled on all endpoints
- [ ] Security headers are configured (automatic via vercel.json)
- [ ] HTTPS is enforced (automatic on Vercel)
- [ ] Pre-commit hooks are blocking secrets (test locally)

---

## Scaling Considerations

### For Higher Traffic

1. **Upgrade Vercel Plan**: Pro plan offers higher limits and faster functions
2. **Upgrade MongoDB Atlas**: Move from shared to dedicated cluster
3. **Add Redis**: For distributed rate limiting (Vercel KV or Upstash)
4. **Add CDN**: For static assets (automatic on Vercel)

### Performance Optimization

1. Enable Vercel Edge caching for static pages
2. Use ISR (Incremental Static Regeneration) for semi-static content
3. Optimize images with Next.js Image component
4. Monitor Web Vitals in Vercel Analytics
