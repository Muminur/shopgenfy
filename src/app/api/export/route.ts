import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { z } from 'zod';
import { imageStore, StoredImageEntry } from '@/lib/image-store';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

export const maxDuration = 60;

// Each call assembles a ZIP in memory, so cap per-client throughput.
const rateLimiter = createRateLimiter(rateLimitConfigs.export);

/**
 * Stateless export. Accepts the current form payload plus the ids of images
 * already normalized and held in the in-process image store, and streams back
 * a ZIP containing metadata, a README, and the real PNG bytes.
 *
 * This works with MongoDB down (nothing here touches the DB). Because the
 * store is per-instance on serverless, some ids may not resolve on the
 * instance that handles the request — those are reported in
 * `metadata.missingImages` and the export still succeeds (never 500s on them).
 */

const submissionSchema = z
  .object({
    appName: z.string().optional().default(''),
    appIntroduction: z.string().optional().default(''),
    appDescription: z.string().optional().default(''),
    features: z.array(z.string()).optional().default([]),
    languages: z.array(z.string()).optional().default([]),
    worksWith: z.array(z.string()).optional().default([]),
    primaryCategory: z.string().optional().default(''),
    secondaryCategory: z.string().optional().default(''),
    pricing: z.unknown().optional(),
    landingPageUrl: z.string().optional().default(''),
  })
  .passthrough();

const exportSchema = z.object({
  submission: submissionSchema,
  imageIds: z.array(z.string()).optional().default([]),
});

type ExportSubmission = z.infer<typeof submissionSchema>;

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, '_');
  return cleaned || 'submission';
}

interface ExportImage {
  entry: StoredImageEntry;
  filename: string;
}

/**
 * Resolve the requested ids from the store, assign deterministic archive paths
 * (`images/icon.png`, `images/feature-1.png`, …), and collect the ids that the
 * store could not resolve.
 */
function collectImages(imageIds: string[]): {
  images: ExportImage[];
  missingImages: string[];
} {
  const images: ExportImage[] = [];
  const missingImages: string[] = [];
  let featureCount = 0;
  let iconSeen = false;

  for (const id of imageIds) {
    const entry = imageStore.get(id);
    if (!entry) {
      missingImages.push(id);
      continue;
    }

    let filename: string;
    if (entry.meta.type === 'icon' && !iconSeen) {
      filename = 'images/icon.png';
      iconSeen = true;
    } else {
      featureCount += 1;
      filename = `images/feature-${featureCount}.png`;
    }
    images.push({ entry, filename });
  }

  return { images, missingImages };
}

function buildMetadata(
  submission: ExportSubmission,
  images: ExportImage[],
  missingImages: string[]
) {
  return {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    submission,
    images: images.map(({ entry, filename }) => ({
      id: entry.meta.id,
      file: filename,
      type: entry.meta.type,
      width: entry.meta.width,
      height: entry.meta.height,
      altText: entry.meta.altText,
      provider: entry.meta.provider,
      featureText: entry.meta.featureText,
    })),
    missingImages,
    shopifyCompliance: {
      appNameLength: `${(submission.appName ?? '').length}/30`,
      appIntroLength: `${(submission.appIntroduction ?? '').length}/100`,
      appDescriptionLength: `${(submission.appDescription ?? '').length}/500`,
      iconDimensions: '1200x1200',
      featureImageDimensions: '1600x900',
    },
  };
}

function buildReadme(
  submission: ExportSubmission,
  images: ExportImage[],
  missingImages: string[]
): string {
  const iconIncluded = images.some((i) => i.filename === 'images/icon.png');
  const featureCount = images.filter((i) => i.filename.startsWith('images/feature-')).length;

  return `
SHOPIFY APP STORE SUBMISSION PACKAGE
====================================

App Name: ${submission.appName || '(untitled)'}
Category: ${submission.primaryCategory || '(none)'}
Export Date: ${new Date().toISOString()}

SUBMISSION CHECKLIST
--------------------
[ ] App name (max 30 characters): ${(submission.appName ?? '').length}/30
[ ] App introduction (max 100 characters): ${(submission.appIntroduction ?? '').length}/100
[ ] App description (max 500 characters): ${(submission.appDescription ?? '').length}/500
[ ] Feature list items: ${(submission.features ?? []).length} items
[ ] Languages: ${(submission.languages ?? []).join(', ') || '(none)'}

IMAGES INCLUDED
---------------
App Icon: ${iconIncluded ? 'Yes (1200x1200px)' : 'No'}
Feature Images: ${featureCount} (1600x900px each)
${missingImages.length > 0 ? `\nNOTE: ${missingImages.length} image(s) could not be embedded (no longer in the server image cache). Re-generate them and export again.\n` : ''}
IMAGE REQUIREMENTS
------------------
- App Icon: 1200x1200px, square, simple logo, no text
- Feature Images: 1600x900px, 16:9 aspect ratio
- No Shopify logos or third-party branding
- No contact information visible

HOW TO SUBMIT
-------------
1. Go to partners.shopify.com
2. Navigate to your app
3. Fill in the listing details using metadata.json
4. Upload images from the images folder
5. Review all content for compliance
6. Submit for review
`.trim();
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = exportSchema.safeParse(rawBody);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 400 });
  }

  const { submission, imageIds } = parsed.data;
  const { images, missingImages } = collectImages(imageIds);
  const metadata = buildMetadata(submission, images, missingImages);
  const readme = buildReadme(submission, images, missingImages);

  try {
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err) => reject(err));

      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
      archive.append(readme, { name: 'README.txt' });

      for (const { entry, filename } of images) {
        archive.append(entry.buffer, { name: filename });
      }

      archive.finalize();
    });

    const filename = `${sanitizeFilename(submission.appName || 'submission')}_shopify_export.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Stateless export error:', error);
    return NextResponse.json({ error: 'Failed to generate export package' }, { status: 500 });
  }
}
