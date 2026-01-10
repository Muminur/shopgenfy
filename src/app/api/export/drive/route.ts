import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getDatabaseConnected } from '@/lib/mongodb';
import { createGoogleDriveClient, GoogleDriveError } from '@/lib/gdrive';
import { COLLECTIONS } from '@/lib/db/collections';

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, '_');
}

const driveExportSchema = z.object({
  submissionId: z
    .string({ message: 'submissionId is required' })
    .min(1, 'submissionId is required'),
});

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

export async function POST(request: NextRequest) {
  // Check for Google credentials
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    console.error('Google Drive credentials not configured');
    return NextResponse.json({ error: 'Drive export service unavailable' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate request
  const parseResult = driveExportSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json({ error: errors }, { status: 400 });
  }

  const { submissionId } = parseResult.data;

  // Validate ObjectId format
  if (!ObjectId.isValid(submissionId)) {
    return NextResponse.json({ error: 'Invalid submissionId format' }, { status: 400 });
  }

  try {
    const db = await getDatabaseConnected();

    // Fetch submission
    const submission = await db
      .collection<SubmissionDocument>(COLLECTIONS.SUBMISSIONS)
      .findOne({ _id: new ObjectId(submissionId) });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Fetch associated images
    const images = await db
      .collection<ImageDocument>(COLLECTIONS.GENERATED_IMAGES)
      .find({ submissionId })
      .sort({ type: 1, createdAt: -1 })
      .toArray();

    // Create Google Drive client
    const driveClient = createGoogleDriveClient({
      clientId,
      clientSecret,
      refreshToken: refreshToken || '',
    });

    // Create export folder with sanitized name
    const sanitizedAppName = sanitizeFilename(submission.appName);
    const folderName = `${sanitizedAppName} - Shopify Export - ${new Date().toISOString().split('T')[0]}`;
    const folder = await driveClient.createFolder({ name: folderName });

    // Upload images to the folder
    let uploadedCount = 0;
    const uploadFailures: Array<{ imageId: string; error: string }> = [];

    for (const image of images) {
      try {
        const fileName =
          image.type === 'icon'
            ? `app_icon.${image.format}`
            : `feature_${sanitizeFilename(image.featureHighlighted || String(uploadedCount))}.${image.format}`;

        await driveClient.uploadFile({
          sourceUrl: image.driveUrl,
          fileName,
          folderId: folder.id,
        });
        uploadedCount++;
      } catch (uploadError) {
        console.error(`Failed to upload image ${image._id}:`, uploadError);
        uploadFailures.push({
          imageId: image._id.toString(),
          error: (uploadError as Error).message,
        });
      }
    }

    // Create metadata
    const metadata = {
      exportedAt: new Date().toISOString(),
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
      },
      images: images.map((img) => ({
        type: img.type,
        url: img.driveUrl,
        dimensions: `${img.width}x${img.height}`,
        featureHighlighted: img.featureHighlighted,
        altText: img.altText,
      })),
    };

    // Upload metadata.json to folder
    await driveClient.uploadFile({
      buffer: Buffer.from(JSON.stringify(metadata, null, 2)),
      fileName: 'metadata.json',
      mimeType: 'application/json',
      folderId: folder.id,
    });

    // Get shareable link (sets public access and returns URL)
    const folderUrl = await driveClient.getFileUrl(folder.id, { makePublic: true });

    return NextResponse.json({
      success: true,
      folderId: folder.id,
      folderUrl,
      uploadedImages: uploadedCount,
      totalImages: images.length,
      failedUploads: uploadFailures.length,
      failures: uploadFailures.length > 0 ? uploadFailures : undefined,
      metadata,
    });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      console.error('Google Drive error:', error.message);
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    console.error('Drive export error:', error);
    return NextResponse.json({ error: 'Failed to export to Google Drive' }, { status: 500 });
  }
}
