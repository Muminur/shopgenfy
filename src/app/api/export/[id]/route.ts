import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import archiver from 'archiver';
import { getDatabaseConnected } from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/db/collections';

interface SubmissionDocument {
  _id: ObjectId;
  appName: string;
  appIntroduction: string;
  appDescription: string;
  featureList: string[];
  languages: string[];
  primaryCategory: string;
  secondaryCategory?: string;
  featureTags: string[];
  pricing: {
    type: string;
    price?: number;
    currency?: string;
    billingCycle?: string;
  };
  landingPageUrl: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ImageDocument {
  _id: ObjectId;
  submissionId: string;
  type: 'icon' | 'feature';
  driveFileId: string;
  driveUrl: string;
  width: number;
  height: number;
  format: string;
  generationPrompt: string;
  featureHighlighted: string;
  altText: string;
  version: number;
  createdAt: Date;
}

interface ExportMetadata {
  exportedAt: string;
  version: string;
  submission: {
    id: string;
    appName: string;
    appIntroduction: string;
    appDescription: string;
    featureList: string[];
    languages: string[];
    primaryCategory: string;
    secondaryCategory?: string;
    featureTags: string[];
    pricing: {
      type: string;
      price?: number;
      currency?: string;
      billingCycle?: string;
    };
    landingPageUrl: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  images: {
    icon?: {
      url: string;
      width: number;
      height: number;
      format: string;
      altText: string;
    };
    features: Array<{
      url: string;
      width: number;
      height: number;
      format: string;
      featureHighlighted: string;
      altText: string;
    }>;
  };
  shopifyRequirements: {
    appNameLimit: number;
    appIntroductionLimit: number;
    appDescriptionLimit: number;
    featureItemLimit: number;
    iconDimensions: string;
    featureImageDimensions: string;
  };
}

function sanitizeFilename(name: string): string {
  // Remove invalid filename characters
  return name.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, '_');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Validate ID format
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid submission ID format' }, { status: 400 });
  }

  try {
    const db = await getDatabaseConnected();

    // Fetch submission
    const submission = await db
      .collection<SubmissionDocument>(COLLECTIONS.SUBMISSIONS)
      .findOne({ _id: new ObjectId(id) });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Fetch associated images
    const images = await db
      .collection<ImageDocument>(COLLECTIONS.GENERATED_IMAGES)
      .find({ submissionId: id })
      .sort({ type: 1, createdAt: -1 })
      .toArray();

    // Separate icon and feature images
    const iconImage = images.find((img) => img.type === 'icon');
    const featureImages = images.filter((img) => img.type === 'feature');

    // Create metadata
    const metadata: ExportMetadata = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      submission: {
        id: submission._id.toString(),
        appName: submission.appName,
        appIntroduction: submission.appIntroduction,
        appDescription: submission.appDescription,
        featureList: submission.featureList,
        languages: submission.languages,
        primaryCategory: submission.primaryCategory,
        secondaryCategory: submission.secondaryCategory,
        featureTags: submission.featureTags,
        pricing: submission.pricing,
        landingPageUrl: submission.landingPageUrl,
        status: submission.status,
        createdAt: submission.createdAt.toISOString(),
        updatedAt: submission.updatedAt.toISOString(),
      },
      images: {
        icon: iconImage
          ? {
              url: iconImage.driveUrl,
              width: iconImage.width,
              height: iconImage.height,
              format: iconImage.format,
              altText: iconImage.altText,
            }
          : undefined,
        features: featureImages.map((img) => ({
          url: img.driveUrl,
          width: img.width,
          height: img.height,
          format: img.format,
          featureHighlighted: img.featureHighlighted,
          altText: img.altText,
        })),
      },
      shopifyRequirements: {
        appNameLimit: 30,
        appIntroductionLimit: 100,
        appDescriptionLimit: 500,
        featureItemLimit: 80,
        iconDimensions: '1200x1200px',
        featureImageDimensions: '1600x900px',
      },
    };

    // Create ZIP archive using a Promise-based approach
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on('error', (err) => {
        reject(err);
      });

      // Add metadata.json
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      // Add README with submission instructions
      const readme = generateReadme(submission, iconImage, featureImages);
      archive.append(readme, { name: 'README.txt' });

      // Add image manifest
      const imageManifest = generateImageManifest(iconImage, featureImages);
      archive.append(JSON.stringify(imageManifest, null, 2), { name: 'images/manifest.json' });

      // Finalize archive
      archive.finalize();
    });

    // Create response with ZIP file
    const sanitizedName = sanitizeFilename(submission.appName);
    const filename = `${sanitizedName}_shopify_export.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to generate export package' }, { status: 500 });
  }
}

function generateReadme(
  submission: SubmissionDocument,
  iconImage: ImageDocument | undefined,
  featureImages: ImageDocument[]
): string {
  return `
SHOPIFY APP STORE SUBMISSION PACKAGE
====================================

App Name: ${submission.appName}
Category: ${submission.primaryCategory}
Export Date: ${new Date().toISOString()}

SUBMISSION CHECKLIST
--------------------
[ ] App name (max 30 characters): ${submission.appName.length}/30
[ ] App introduction (max 100 characters): ${submission.appIntroduction.length}/100
[ ] App description (max 500 characters): ${submission.appDescription.length}/500
[ ] Feature list items: ${submission.featureList.length} items
[ ] Languages: ${submission.languages.join(', ')}
[ ] Category: ${submission.primaryCategory}${submission.secondaryCategory ? ` / ${submission.secondaryCategory}` : ''}
[ ] Feature tags: ${submission.featureTags.length} tags

IMAGES INCLUDED
---------------
App Icon: ${iconImage ? 'Yes (1200x1200px)' : 'No'}
Feature Images: ${featureImages.length} images (1600x900px each)

IMAGE REQUIREMENTS
------------------
- App Icon: 1200x1200px, square, simple logo, no text
- Feature Images: 1600x900px, 16:9 aspect ratio
- No Shopify logos or branding
- No third-party branding
- No contact information visible
- Safe zone: ~100px from edges

HOW TO SUBMIT
-------------
1. Go to partners.shopify.com
2. Navigate to your app
3. Fill in the listing details using metadata.json
4. Upload images from the images folder
5. Review all content for compliance
6. Submit for review

For more information, visit:
https://shopify.dev/docs/apps/store/requirements
`.trim();
}

function generateImageManifest(
  iconImage: ImageDocument | undefined,
  featureImages: ImageDocument[]
): object {
  return {
    icon: iconImage
      ? {
          filename: `icon.${iconImage.format}`,
          url: iconImage.driveUrl,
          dimensions: `${iconImage.width}x${iconImage.height}`,
          altText: iconImage.altText,
        }
      : null,
    features: featureImages.map((img, index) => ({
      filename: `feature_${index + 1}.${img.format}`,
      url: img.driveUrl,
      dimensions: `${img.width}x${img.height}`,
      featureHighlighted: img.featureHighlighted,
      altText: img.altText,
    })),
    totalImages: (iconImage ? 1 : 0) + featureImages.length,
  };
}
