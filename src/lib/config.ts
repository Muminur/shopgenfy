/**
 * API Configuration Module
 *
 * Centralized configuration for all external API endpoints and application settings.
 * This module provides type-safe access to configuration constants.
 */

// General API configuration
export const API_CONFIG = {
  defaultTimeout: 30000, // 30 seconds
  retry: {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
  },
} as const;

// Gemini API configuration
export const GEMINI_CONFIG = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  defaultModel: 'gemini-2.0-flash',
  endpoints: {
    models: '/models',
    generateContent: '/models/{model}:generateContent',
    streamGenerateContent: '/models/{model}:streamGenerateContent',
  },
  maxTokens: {
    input: 30720,
    output: 8192,
  },
} as const;

// Nano Banana API configuration
export const NANO_BANANA_CONFIG = {
  baseUrl: 'https://api.nanobanana.io/v1',
  supportedDimensions: {
    icon: { width: 1200, height: 1200 },
    feature: { width: 1600, height: 900 },
  },
  endpoints: {
    generate: '/generate',
    status: '/status',
    version: '/version',
  },
  supportedFormats: ['png', 'jpeg'] as const,
  maxFileSize: 20 * 1024 * 1024, // 20MB
} as const;

// Google Drive API configuration
export const GOOGLE_DRIVE_CONFIG = {
  baseUrl: 'https://www.googleapis.com/drive/v3',
  uploadUrl: 'https://www.googleapis.com/upload/drive/v3',
  authUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
  mimeTypes: {
    folder: 'application/vnd.google-apps.folder',
    json: 'application/json',
    png: 'image/png',
    jpeg: 'image/jpeg',
  },
} as const;

// MongoDB configuration
export const MONGODB_CONFIG = {
  pool: {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
  },
  timeouts: {
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 30000,
  },
  collections: {
    submissions: 'submissions',
    users: 'users',
    images: 'generated_images',
    apiVersions: 'api_versions',
  },
} as const;

// Application configuration
export const APP_CONFIG = {
  name: 'Shopgenfy',
  version: '0.1.0',
  // Shopify App Store compliance limits
  shopifyLimits: {
    appName: 30,
    appIntroduction: 100,
    appDescription: 500,
    featureItem: 80,
    worksWith: 6,
    featureTags: 25,
  },
  // Image requirements
  imageRequirements: {
    icon: {
      width: 1200,
      height: 1200,
      format: 'png' as const,
    },
    feature: {
      width: 1600,
      height: 900,
      format: 'png' as const,
    },
    maxFileSize: 20 * 1024 * 1024, // 20MB
    safeZone: 100, // 100px from edges
    minContrast: 4.5, // WCAG AA requirement
  },
  // Supported categories
  categories: [
    'Marketing',
    'Sales',
    'Customer Service',
    'Inventory Management',
    'Shipping',
    'Reporting',
    'Store Design',
    'Finding Products',
    'Orders and Shipping',
    'Trust and Security',
  ],
  // Supported languages
  languages: [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'zh', name: 'Chinese' },
  ],
} as const;

// Type exports for use in other modules
export type GeminiModel = (typeof GEMINI_CONFIG.models)[number];
export type ImageFormat = (typeof NANO_BANANA_CONFIG.supportedFormats)[number];
export type CollectionName = keyof typeof MONGODB_CONFIG.collections;
