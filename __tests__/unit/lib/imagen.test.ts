import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store mock implementations for later access
let mockGenerateImages: ReturnType<typeof vi.fn>;

// Mock the @google/genai module before any imports
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models: { generateImages: ReturnType<typeof vi.fn> };
      constructor() {
        this.models = {
          generateImages: mockGenerateImages,
        };
      }
    },
    Modality: {
      IMAGE: 'IMAGE',
    },
  };
});

import { createImagenClient, ImagenError, SHOPIFY_IMAGE_SPECS } from '@/lib/imagen';

describe('Imagen Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock function
    mockGenerateImages = vi.fn();
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

    it('specifies correct formats for both image types', () => {
      expect(SHOPIFY_IMAGE_SPECS.appIcon.formats).toContain('png');
      expect(SHOPIFY_IMAGE_SPECS.appIcon.formats).toContain('jpeg');
      expect(SHOPIFY_IMAGE_SPECS.featureImage.formats).toContain('png');
      expect(SHOPIFY_IMAGE_SPECS.featureImage.formats).toContain('jpeg');
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

    it('creates client with valid API key', () => {
      const client = createImagenClient('test-api-key');
      expect(client).toBeDefined();
      expect(client.generateImages).toBeDefined();
      expect(client.generateAppIcon).toBeDefined();
      expect(client.generateFeatureImage).toBeDefined();
      expect(client.generateAllImages).toBeDefined();
    });
  });

  describe('ImagenError', () => {
    it('has correct name', () => {
      const error = new ImagenError('Test error');
      expect(error.name).toBe('ImagenError');
    });

    it('stores code and details', () => {
      const error = new ImagenError('Test error', 'TEST_CODE', { detail: 'info' });
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'info' });
    });
  });

  describe('generateImages', () => {
    it('throws error if prompt is empty', async () => {
      const client = createImagenClient('test-api-key');

      await expect(client.generateImages({ prompt: '', type: 'icon' })).rejects.toThrow(
        'Prompt is required'
      );
    });

    it('throws error if prompt is whitespace', async () => {
      const client = createImagenClient('test-api-key');

      await expect(client.generateImages({ prompt: '   ', type: 'icon' })).rejects.toThrow(
        'Prompt is required'
      );
    });

    it('calls API with correct parameters for icon', async () => {
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: Buffer.from('test-image-data').toString('base64'),
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      await client.generateImages({
        prompt: 'Test icon prompt',
        type: 'icon',
        numberOfImages: 1,
      });

      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'imagen-4.0-generate-001',
          config: expect.objectContaining({
            aspectRatio: '1:1',
            numberOfImages: 1,
          }),
        })
      );
    });

    it('calls API with correct parameters for feature image', async () => {
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: Buffer.from('test-image-data').toString('base64'),
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      await client.generateImages({
        prompt: 'Test feature prompt',
        type: 'feature',
        numberOfImages: 1,
      });

      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            aspectRatio: '16:9',
          }),
        })
      );
    });

    it('throws error when no images are generated', async () => {
      mockGenerateImages.mockResolvedValue({
        generatedImages: [],
      });

      const client = createImagenClient('test-api-key');
      await expect(client.generateImages({ prompt: 'Test', type: 'icon' })).rejects.toThrow(
        'No images were generated'
      );
    });

    it('returns correctly formatted images', async () => {
      const testImageData = Buffer.from('test-image-data').toString('base64');
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: testImageData,
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      const result = await client.generateImages({
        prompt: 'Test prompt',
        type: 'icon',
      });

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toMatchObject({
        type: 'icon',
        mimeType: 'image/png',
        width: 1200,
        height: 1200,
      });
      expect(result.images[0].url).toContain('data:image/png;base64,');
      expect(result.model).toBe('imagen-4.0-generate-001');
      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('generateAppIcon', () => {
    it('generates icon with correct dimensions', async () => {
      const testImageData = Buffer.from('icon-data').toString('base64');
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: testImageData,
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      const image = await client.generateAppIcon('Test App', 'A test application');

      expect(image.type).toBe('icon');
      expect(image.width).toBe(1200);
      expect(image.height).toBe(1200);
      expect(image.altText).toBe('Test App app icon');
    });

    it('sanitizes Shopify branding from prompt', async () => {
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: Buffer.from('test').toString('base64'),
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      await client.generateAppIcon('Shopify App', 'Best Shopify integration');

      // Verify the mock was called
      expect(mockGenerateImages).toHaveBeenCalled();

      // Get the actual call argument
      const callArg = mockGenerateImages.mock.calls[0][0];

      // Verify the app name "Shopify App" was sanitized to just "App"
      expect(callArg.prompt).toContain('"App"');
      expect(callArg.prompt).not.toContain('"Shopify App"');

      // Verify the description "Best Shopify integration" was sanitized to "Best integration"
      expect(callArg.prompt).toContain('Best integration');
      expect(callArg.prompt).not.toContain('Best Shopify integration');
    });
  });

  describe('generateFeatureImage', () => {
    it('generates feature image with correct dimensions', async () => {
      const testImageData = Buffer.from('feature-data').toString('base64');
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: testImageData,
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      const image = await client.generateFeatureImage(
        'Test App',
        'Dashboard Analytics',
        'A powerful analytics dashboard'
      );

      expect(image.type).toBe('feature');
      expect(image.width).toBe(1600);
      expect(image.height).toBe(900);
      expect(image.altText).toBe('Test App - Dashboard Analytics');
    });
  });

  describe('generateAllImages', () => {
    it('generates icon and feature images', async () => {
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: Buffer.from('image-data').toString('base64'),
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      const images = await client.generateAllImages('Test App', 'A test application', [
        'Feature 1',
        'Feature 2',
      ]);

      // Should have 1 icon + 2 feature images
      expect(images).toHaveLength(3);
      expect(images[0].type).toBe('icon');
      expect(images[1].type).toBe('feature');
      expect(images[2].type).toBe('feature');
    });

    it('limits feature images to maximum of 3', async () => {
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: Buffer.from('image-data').toString('base64'),
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      const images = await client.generateAllImages('Test App', 'Description', [
        'Feature 1',
        'Feature 2',
        'Feature 3',
        'Feature 4',
        'Feature 5',
      ]);

      // Should have 1 icon + 3 feature images (max 3)
      expect(images).toHaveLength(4);
      // generateImages should be called 4 times (1 icon + 3 features)
      expect(mockGenerateImages).toHaveBeenCalledTimes(4);
    });

    it('filters empty features', async () => {
      mockGenerateImages.mockResolvedValue({
        generatedImages: [
          {
            image: {
              imageBytes: Buffer.from('image-data').toString('base64'),
            },
          },
        ],
      });

      const client = createImagenClient('test-api-key');
      const images = await client.generateAllImages('Test App', 'Description', [
        'Feature 1',
        '',
        '   ',
        'Feature 2',
      ]);

      // Should have 1 icon + 2 non-empty feature images
      expect(images).toHaveLength(3);
    });
  });
});
