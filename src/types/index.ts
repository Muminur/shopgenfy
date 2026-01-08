export type SubmissionStatus = 'draft' | 'complete' | 'exported';

export interface PricingConfig {
  type: 'free' | 'freemium' | 'paid' | 'subscription';
  price?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'yearly' | 'one-time';
  trialDays?: number;
}

export interface Submission {
  id: string;
  userId: string;
  appName: string;
  appIntroduction: string;
  appDescription: string;
  featureList: string[];
  languages: string[];
  worksWith: string[];
  primaryCategory: string;
  secondaryCategory?: string;
  featureTags: string[];
  pricing: PricingConfig;
  landingPageUrl: string;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedImage {
  id: string;
  submissionId: string;
  type: 'icon' | 'feature';
  driveFileId: string;
  driveUrl: string;
  width: number;
  height: number;
  format: 'png' | 'jpeg';
  generationPrompt: string;
  featureHighlighted: string;
  altText: string;
  version: number;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  selectedGeminiModel: string;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface APIVersion {
  id: string;
  service: 'gemini' | 'nanobanana';
  currentVersion: string;
  lastKnownGood: string;
  availableVersions: string[];
  lastChecked: Date;
}
