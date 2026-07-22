import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store mock implementation for later access. The Gemini image model is driven
// through `ai.models.generateContent` (native `gemini-3.1-flash-image`), not the
// retired `imagen-4.0` / `gemini-2.0-flash-exp` calls.
let mockGenerateContent: ReturnType<typeof vi.fn>;

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models: { generateContent: ReturnType<typeof vi.fn> };
      constructor() {
        this.models = { generateContent: mockGenerateContent };
      }
    },
    Modality: { IMAGE: 'IMAGE', TEXT: 'TEXT' },
  };
});

import {
  createImagenClient,
  ImagenError,
  SHOPIFY_IMAGE_SPECS,
  selectScreenshotSubset,
  type ReferenceScreenshot,
} from '@/lib/imagen';
import { clearDeadModelCache } from '@/lib/model-resolver';

function imageResponse(
  base64: string = Buffer.from('generated-image-bytes').toString('base64'),
  mimeType = 'image/png'
) {
  return {
    candidates: [{ content: { parts: [{ inlineData: { data: base64, mimeType } }] } }],
  };
}

function textOnlyResponse() {
  return {
    candidates: [{ content: { parts: [{ text: 'no image was produced' }] } }],
  };
}

describe('Imagen Client (Gemini native image generation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent = vi.fn();
    clearDeadModelCache();
    delete process.env.GEMINI_IMAGE_MODEL;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('SHOPIFY_IMAGE_SPECS', () => {
    it('defines correct app icon dimensions', () => {
      expect(SHOPIFY_IMAGE_SPECS.appIcon.width).toBe(1200);
      expect(SHOPIFY_IMAGE_SPECS.appIcon.height).toBe(1200);
      expect(SHOPIFY_IMAGE_SPECS.appIcon.aspectRatio).toBe('1:1');
    });

    it('defines correct feature image dimensions', () => {
      expect(SHOPIFY_IMAGE_SPECS.featureImage.width).toBe(1600);
      expect(SHOPIFY_IMAGE_SPECS.featureImage.height).toBe(900);
      expect(SHOPIFY_IMAGE_SPECS.featureImage.aspectRatio).toBe('16:9');
    });
  });

  describe('createImagenClient', () => {
    it('throws error if API key is missing', () => {
      expect(() => createImagenClient('')).toThrow(ImagenError);
      expect(() => createImagenClient('')).toThrow('API key is required');
    });

    it('throws error if API key is whitespace', () => {
      expect(() => createImagenClient('   ')).toThrow(ImagenError);
    });

    it('creates client with the expected public methods', () => {
      const client = createImagenClient('test-api-key');
      expect(client.generateAppIcon).toBeDefined();
      expect(client.generateFeatureImage).toBeDefined();
      expect(client.generateFeatureImageWithScreenshots).toBeDefined();
      expect(client.generateAllImages).toBeDefined();
    });
  });

  describe('ImagenError', () => {
    it('has correct name and carries code + statusCode', () => {
      const error = new ImagenError('Test error', 'UPSTREAM', 502, { detail: 'info' });
      expect(error.name).toBe('ImagenError');
      expect(error.code).toBe('UPSTREAM');
      expect(error.statusCode).toBe(502);
      expect(error.details).toEqual({ detail: 'info' });
    });
  });

  describe('generateAppIcon', () => {
    it('calls generateContent with the resolved image model and 1:1 / 2K imageConfig', async () => {
      mockGenerateContent.mockResolvedValue(imageResponse());

      const client = createImagenClient('test-api-key');
      const image = await client.generateAppIcon('Test App', 'A test application');

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3.1-flash-image',
          config: expect.objectContaining({
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: expect.objectContaining({ aspectRatio: '1:1', imageSize: '2K' }),
          }),
        })
      );

      expect(image.type).toBe('icon');
      expect(Buffer.isBuffer(image.buffer)).toBe(true);
      expect(image.buffer.length).toBeGreaterThan(0);
      expect(image.usedScreenshots).toBe(false);
      expect(image.altText).toBe('Test App app icon');
    });

    it('sanitizes Shopify branding from the icon prompt', async () => {
      mockGenerateContent.mockResolvedValue(imageResponse());

      const client = createImagenClient('test-api-key');
      await client.generateAppIcon('Shopify App', 'Best Shopify integration');

      const callArg = mockGenerateContent.mock.calls[0][0] as {
        contents: Array<{ text?: string }>;
      };
      const textPart = callArg.contents.find((p) => typeof p.text === 'string')?.text ?? '';
      expect(textPart).toContain('"App"');
      expect(textPart).not.toContain('"Shopify App"');
      expect(textPart).toContain('Best integration');
    });

    it('throws NO_IMAGE ImagenError when the model returns no image part', async () => {
      mockGenerateContent.mockResolvedValue(textOnlyResponse());

      const client = createImagenClient('test-api-key');
      await expect(client.generateAppIcon('Test App')).rejects.toMatchObject({
        name: 'ImagenError',
        code: 'NO_IMAGE',
      });
    });

    it('maps an upstream SDK failure to an UPSTREAM/502 ImagenError', async () => {
      mockGenerateContent.mockRejectedValue(new Error('network exploded'));

      const client = createImagenClient('test-api-key');
      await expect(client.generateAppIcon('Test App')).rejects.toMatchObject({
        name: 'ImagenError',
        code: 'UPSTREAM',
        statusCode: 502,
      });
    });
  });

  describe('generateFeatureImage', () => {
    it('generates a feature image at 16:9 with usedScreenshots=false', async () => {
      mockGenerateContent.mockResolvedValue(imageResponse());

      const client = createImagenClient('test-api-key');
      const image = await client.generateFeatureImage(
        'Test App',
        'Dashboard Analytics',
        'A powerful analytics dashboard'
      );

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            imageConfig: expect.objectContaining({ aspectRatio: '16:9', imageSize: '2K' }),
          }),
        })
      );
      expect(image.type).toBe('feature');
      expect(image.usedScreenshots).toBe(false);
      expect(image.featureText).toBe('Dashboard Analytics');
      expect(image.altText).toBe('Test App - Dashboard Analytics');
      expect(Buffer.isBuffer(image.buffer)).toBe(true);
    });
  });

  describe('generateFeatureImageWithScreenshots', () => {
    const screenshots: ReferenceScreenshot[] = [
      { base64: 'c2hvdDE=', mimeType: 'image/png' },
      { base64: 'c2hvdDI=', mimeType: 'image/jpeg' },
    ];

    it('passes screenshots as inline image parts and reports usedScreenshots=true', async () => {
      mockGenerateContent.mockResolvedValue(imageResponse());

      const client = createImagenClient('test-api-key');
      const image = await client.generateFeatureImageWithScreenshots({
        appName: 'Test App',
        featureText: 'Live sync',
        description: 'Keeps data in sync',
        screenshots,
      });

      const callArg = mockGenerateContent.mock.calls[0][0] as {
        contents: Array<{ inlineData?: { data: string } }>;
      };
      const inlineParts = callArg.contents.filter((p) => p.inlineData);
      expect(inlineParts.length).toBeGreaterThan(0);
      expect(inlineParts[0].inlineData?.data).toBe('c2hvdDE=');

      expect(image.type).toBe('feature');
      expect(image.usedScreenshots).toBe(true);
      expect(Buffer.isBuffer(image.buffer)).toBe(true);
    });

    it('falls back to prompt-only generation (usedScreenshots=false) when the screenshot-guided call yields no image', async () => {
      mockGenerateContent
        .mockResolvedValueOnce(textOnlyResponse()) // screenshot-guided call: no image
        .mockResolvedValueOnce(imageResponse()); // prompt-only fallback: image

      const client = createImagenClient('test-api-key');
      const image = await client.generateFeatureImageWithScreenshots({
        appName: 'Test App',
        featureText: 'Live sync',
        screenshots,
      });

      expect(image.usedScreenshots).toBe(false);
      expect(Buffer.isBuffer(image.buffer)).toBe(true);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('falls back to prompt-only generation when no screenshots are supplied', async () => {
      mockGenerateContent.mockResolvedValue(imageResponse());

      const client = createImagenClient('test-api-key');
      const image = await client.generateFeatureImageWithScreenshots({
        appName: 'Test App',
        featureText: 'Live sync',
        screenshots: [],
      });

      expect(image.usedScreenshots).toBe(false);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateAllImages', () => {
    it('generates 1 icon + up to 3 feature images', async () => {
      mockGenerateContent.mockResolvedValue(imageResponse());

      const client = createImagenClient('test-api-key');
      const images = await client.generateAllImages('Test App', 'A test application', [
        'Feature 1',
        'Feature 2',
      ]);

      expect(images).toHaveLength(3);
      expect(images[0].type).toBe('icon');
      expect(images[1].type).toBe('feature');
      expect(images[2].type).toBe('feature');
    });

    it('marks feature images usedScreenshots=true when screenshots are provided', async () => {
      mockGenerateContent.mockResolvedValue(imageResponse());
      const shots: ReferenceScreenshot[] = [
        { base64: 'YQ==', mimeType: 'image/png' },
        { base64: 'Yg==', mimeType: 'image/png' },
        { base64: 'Yw==', mimeType: 'image/png' },
      ];

      const client = createImagenClient('test-api-key');
      const images = await client.generateAllImages('Test App', 'desc', ['F1', 'F2'], shots);

      const features = images.filter((i) => i.type === 'feature');
      expect(features.every((f) => f.usedScreenshots)).toBe(true);
    });
  });

  describe('selectScreenshotSubset', () => {
    const shots: ReferenceScreenshot[] = [
      { base64: 's0', mimeType: 'image/png' },
      { base64: 's1', mimeType: 'image/png' },
      { base64: 's2', mimeType: 'image/png' },
      { base64: 's3', mimeType: 'image/png' },
    ];

    const asSet = (arr: ReferenceScreenshot[]) => new Set(arr.map((s) => s.base64));
    const setsEqual = (a: Set<string>, b: Set<string>) =>
      a.size === b.size && [...a].every((x) => b.has(x));

    it('returns pairwise-distinct sets across feature indices when 2+ screenshots exist', () => {
      const s0 = asSet(selectScreenshotSubset(shots, 0));
      const s1 = asSet(selectScreenshotSubset(shots, 1));
      const s2 = asSet(selectScreenshotSubset(shots, 2));
      expect(setsEqual(s0, s1)).toBe(false);
      expect(setsEqual(s1, s2)).toBe(false);
      expect(setsEqual(s0, s2)).toBe(false);
    });

    it('never produces identical sets for consecutive indices with exactly two screenshots', () => {
      const two = shots.slice(0, 2);
      const a = asSet(selectScreenshotSubset(two, 0));
      const b = asSet(selectScreenshotSubset(two, 1));
      expect(setsEqual(a, b)).toBe(false);
    });

    it('returns the single screenshot for every index when only one exists', () => {
      const one = shots.slice(0, 1);
      expect(selectScreenshotSubset(one, 0).map((s) => s.base64)).toEqual(['s0']);
      expect(selectScreenshotSubset(one, 5).map((s) => s.base64)).toEqual(['s0']);
    });

    it('returns an empty array when there are no screenshots', () => {
      expect(selectScreenshotSubset([], 0)).toEqual([]);
    });
  });
});
