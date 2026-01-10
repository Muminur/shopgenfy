/**
 * Database Seed Script
 *
 * Populates the database with development/test data.
 * Usage: npx ts-node scripts/seed.ts
 *
 * Options:
 *   --clear    Clear existing data before seeding
 *   --users    Seed only users
 *   --submissions  Seed only submissions
 *   --images   Seed only images
 */

import { Db, ObjectId, InsertManyResult } from 'mongodb';
import type { PricingConfig } from '@/types';

// Seed data definitions
export const SEED_DATA = {
  users: [
    {
      email: 'dev@shopgenfy.test',
      selectedGeminiModel: 'gemini-pro',
      theme: 'light' as const,
      autoSave: true,
    },
    {
      email: 'tester@shopgenfy.test',
      selectedGeminiModel: 'gemini-1.5-flash',
      theme: 'dark' as const,
      autoSave: true,
    },
    {
      email: 'demo@shopgenfy.test',
      selectedGeminiModel: 'gemini-pro',
      theme: 'system' as const,
      autoSave: false,
    },
  ],
  submissions: [
    {
      appName: 'InventoryPro',
      appIntroduction: 'Smart inventory management for modern stores',
      appDescription:
        'InventoryPro helps you manage your inventory with AI-powered forecasting, real-time stock alerts, and seamless integration with your sales channels. Track products, set reorder points, and never run out of stock again.',
      featureList: [
        'AI-powered demand forecasting',
        'Real-time stock level alerts',
        'Multi-location inventory tracking',
        'Automatic reorder suggestions',
      ],
      languages: ['en', 'es', 'fr'],
      worksWith: ['Shopify POS', 'Online Store'],
      primaryCategory: 'Inventory Management',
      featureTags: ['inventory', 'automation', 'ai'],
      pricing: { type: 'freemium' } as PricingConfig,
      landingPageUrl: 'https://inventorypro.example.com',
      status: 'complete' as const,
    },
    {
      appName: 'ReviewBoost',
      appIntroduction: 'Collect and showcase customer reviews',
      appDescription:
        'ReviewBoost automatically collects customer reviews, displays them beautifully on your store, and helps you respond to feedback. Boost social proof and increase conversions.',
      featureList: [
        'Automated review request emails',
        'Beautiful review widgets',
        'Photo and video reviews',
        'Review response management',
      ],
      languages: ['en'],
      worksWith: ['Online Store'],
      primaryCategory: 'Marketing',
      featureTags: ['reviews', 'social-proof', 'marketing'],
      pricing: { type: 'paid', price: 9.99, billingCycle: 'monthly' } as PricingConfig,
      landingPageUrl: 'https://reviewboost.example.com',
      status: 'draft' as const,
    },
    {
      appName: 'ShipFast',
      appIntroduction: 'Streamlined shipping for global stores',
      appDescription:
        'ShipFast connects you with multiple shipping carriers, compares rates in real-time, and automates label printing. Save time and money on every shipment.',
      featureList: [
        'Multi-carrier rate comparison',
        'Automatic label generation',
        'Tracking notifications',
        'Returns management',
      ],
      languages: ['en', 'de'],
      worksWith: ['Shopify POS', 'Online Store', 'Buy Button'],
      primaryCategory: 'Shipping',
      featureTags: ['shipping', 'logistics', 'automation'],
      pricing: { type: 'subscription', price: 29.99, billingCycle: 'monthly' } as PricingConfig,
      landingPageUrl: 'https://shipfast.example.com',
      status: 'draft' as const,
    },
  ],
};

interface SeedOptions {
  clearFirst?: boolean;
}

/**
 * Seed users collection
 */
export async function seedUsers(db: Db): Promise<InsertManyResult> {
  const collection = db.collection('users');
  const now = new Date();

  // Check for existing users to avoid duplicates
  for (const userData of SEED_DATA.users) {
    const existing = await collection.findOne({ email: userData.email });
    if (existing) {
      await collection.deleteOne({ email: userData.email });
    }
  }

  const users = SEED_DATA.users.map((user) => ({
    ...user,
    createdAt: now,
    updatedAt: now,
  }));

  return collection.insertMany(users);
}

/**
 * Seed submissions collection
 */
export async function seedSubmissions(db: Db): Promise<InsertManyResult> {
  const usersCollection = db.collection('users');
  const submissionsCollection = db.collection('submissions');
  const now = new Date();

  // Get all users to assign submissions
  const users = await usersCollection.find().toArray();
  if (users.length === 0) {
    throw new Error('No users found. Seed users first.');
  }

  // Clear existing submissions for these seed users
  const userIds = users.map((u) => u._id);
  await submissionsCollection.deleteMany({ userId: { $in: userIds } });

  const submissions = SEED_DATA.submissions.map((sub, index) => ({
    ...sub,
    userId: users[index % users.length]._id,
    createdAt: now,
    updatedAt: now,
  }));

  return submissionsCollection.insertMany(submissions);
}

/**
 * Seed generated_images collection
 */
export async function seedImages(db: Db): Promise<InsertManyResult> {
  const submissionsCollection = db.collection('submissions');
  const imagesCollection = db.collection('generated_images');
  const now = new Date();

  // Get all submissions to assign images
  const submissions = await submissionsCollection.find().toArray();
  if (submissions.length === 0) {
    throw new Error('No submissions found. Seed submissions first.');
  }

  // Clear existing images for these submissions
  const subIds = submissions.map((s) => s._id);
  await imagesCollection.deleteMany({ submissionId: { $in: subIds } });

  // Generate images for each submission
  const images: Array<Record<string, unknown>> = [];

  for (const sub of submissions) {
    // Add icon
    images.push({
      submissionId: sub._id,
      type: 'icon',
      driveFileId: `drive-${new ObjectId().toString()}`,
      driveUrl: `https://drive.google.com/file/d/${new ObjectId().toString()}/view`,
      width: 1200,
      height: 1200,
      format: 'png',
      generationPrompt: `App icon for ${sub.appName}`,
      featureHighlighted: 'Brand Identity',
      altText: `${sub.appName} app icon`,
      version: 1,
      createdAt: now,
    });

    // Add feature images
    const features = sub.featureList?.slice(0, 3) || ['Feature 1', 'Feature 2'];
    for (const feature of features) {
      images.push({
        submissionId: sub._id,
        type: 'feature',
        driveFileId: `drive-${new ObjectId().toString()}`,
        driveUrl: `https://drive.google.com/file/d/${new ObjectId().toString()}/view`,
        width: 1600,
        height: 900,
        format: 'png',
        generationPrompt: `Feature image showing ${feature}`,
        featureHighlighted: feature,
        altText: `${sub.appName} - ${feature}`,
        version: 1,
        createdAt: now,
      });
    }
  }

  return imagesCollection.insertMany(images);
}

/**
 * Clear all collections
 */
export async function clearDatabase(db: Db): Promise<void> {
  await Promise.all([
    db.collection('users').deleteMany({}),
    db.collection('submissions').deleteMany({}),
    db.collection('generated_images').deleteMany({}),
  ]);
}

/**
 * Seed all collections in correct order
 */
export async function seedAll(
  db: Db,
  options: SeedOptions = {}
): Promise<{
  users: InsertManyResult;
  submissions: InsertManyResult;
  images: InsertManyResult;
}> {
  if (options.clearFirst) {
    await clearDatabase(db);
  }

  const users = await seedUsers(db);
  const submissions = await seedSubmissions(db);
  const images = await seedImages(db);

  return { users, submissions, images };
}

// CLI execution
/* eslint-disable no-console */
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getMongoClientConnected } = require('../src/lib/mongodb');

  async function main() {
    const args = process.argv.slice(2);
    const clearFirst = args.includes('--clear');

    console.log('🌱 Starting database seed...');

    const client = await getMongoClientConnected();
    const db = client.db(process.env.MONGODB_DB_NAME || 'shopgenfy');

    try {
      const result = await seedAll(db, { clearFirst });

      console.log(`✅ Seeded ${result.users.insertedCount} users`);
      console.log(`✅ Seeded ${result.submissions.insertedCount} submissions`);
      console.log(`✅ Seeded ${result.images.insertedCount} images`);
      console.log('🎉 Seed complete!');
    } finally {
      await client.close();
    }
  }

  main().catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
}
