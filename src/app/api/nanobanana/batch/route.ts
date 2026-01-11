import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { createNanoBananaClient, NanoBananaError, ImageGenerationRequest } from '@/lib/nanobanana';
import { getDatabaseConnected } from '@/lib/mongodb';
import { createGeneratedImage, CreateImageInput } from '@/lib/db/images';
import { generateBatchPrompts, GeneratedPrompt } from '@/lib/prompt-generator';
import { COLLECTIONS } from '@/lib/db/collections';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

const batchRequestSchema = z.object({
  submissionId: z
    .string({ message: 'submissionId is required' })
    .min(1, 'submissionId is required'),
});

interface SubmissionDocument {
  _id: ObjectId;
  appName: string;
  appIntroduction?: string;
  appDescription?: string;
  primaryCategory: string;
  features: string[];
  status: string;
}

interface BatchImageResult {
  id?: string;
  type: 'icon' | 'feature';
  jobId: string;
  status: string;
  imageUrl?: string;
  width: number;
  height: number;
  featureHighlighted?: string;
}

const rateLimiter = createRateLimiter(rateLimitConfigs.nanobanana.batch);

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const apiKey = process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    console.error('NANO_BANANA_API_KEY environment variable not configured');
    return NextResponse.json({ error: 'Image generation service unavailable' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate request
  const parseResult = batchRequestSchema.safeParse(body);
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
    // Get database and fetch submission
    const db = await getDatabaseConnected();
    const submission = await db.collection<SubmissionDocument>(COLLECTIONS.SUBMISSIONS).findOne({
      _id: new ObjectId(submissionId),
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Generate prompts using the prompt generator
    const prompts = generateBatchPrompts({
      appName: submission.appName,
      primaryCategory: submission.primaryCategory,
      features: submission.features || [],
      appDescription: submission.appDescription,
    });

    // Convert prompts to image generation requests
    const imageRequests: ImageGenerationRequest[] = prompts.map((prompt: GeneratedPrompt) => ({
      type: prompt.type,
      prompt: prompt.prompt,
      style: 'modern' as const,
      negativePrompt: prompt.negativePrompt,
      featureHighlight: prompt.featureHighlighted,
    }));

    // Call Nano Banana batch generation
    const client = createNanoBananaClient(apiKey);
    const results = await client.generateBatch(imageRequests);

    // Store generated images in database
    const storedImages: BatchImageResult[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const prompt = prompts[i];

      if (result.status === 'completed' && result.imageUrl) {
        const imageInput: CreateImageInput = {
          submissionId,
          type: prompt.type,
          driveFileId: result.jobId, // Using jobId as placeholder until uploaded to Drive
          driveUrl: result.imageUrl,
          width: result.width || prompt.width,
          height: result.height || prompt.height,
          format: (result.format as 'png' | 'jpeg') || 'png',
          generationPrompt: prompt.prompt,
          featureHighlighted: prompt.featureHighlighted || '',
          altText: `${submission.appName} ${prompt.type === 'icon' ? 'app icon' : `feature: ${prompt.featureHighlighted}`}`,
          version: 1,
        };

        const savedImage = await createGeneratedImage(db, imageInput);

        storedImages.push({
          id: savedImage._id.toString(),
          type: prompt.type,
          jobId: result.jobId,
          status: result.status,
          imageUrl: result.imageUrl,
          width: imageInput.width,
          height: imageInput.height,
          featureHighlighted: prompt.featureHighlighted,
        });
      } else {
        storedImages.push({
          type: prompt.type,
          jobId: result.jobId,
          status: result.status,
          imageUrl: result.imageUrl,
          width: prompt.width,
          height: prompt.height,
          featureHighlighted: prompt.featureHighlighted,
        });
      }
    }

    // Update submission to mark images as generated
    await db.collection(COLLECTIONS.SUBMISSIONS).updateOne(
      { _id: new ObjectId(submissionId) },
      {
        $set: {
          imagesGenerated: true,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      submissionId,
      images: storedImages,
      totalGenerated: storedImages.length,
    });
  } catch (error) {
    if (error instanceof NanoBananaError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    console.error('Batch generation error:', error);
    return NextResponse.json({ error: 'Failed to generate images' }, { status: 500 });
  }
}
