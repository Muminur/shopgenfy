import { Db, IndexDescription } from 'mongodb';

export const COLLECTIONS = {
  SUBMISSIONS: 'submissions',
  GENERATED_IMAGES: 'generated_images',
  USERS: 'users',
  API_VERSIONS: 'api_versions',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const INDEXES: Record<CollectionName, IndexDescription[]> = {
  [COLLECTIONS.SUBMISSIONS]: [
    { key: { userId: 1, updatedAt: -1 }, name: 'userId_updatedAt' },
    { key: { userId: 1, status: 1 }, name: 'userId_status' },
    { key: { landingPageUrl: 1 }, name: 'landingPageUrl' },
  ],
  [COLLECTIONS.GENERATED_IMAGES]: [
    { key: { submissionId: 1 }, name: 'submissionId' },
    { key: { submissionId: 1, type: 1 }, name: 'submissionId_type' },
  ],
  [COLLECTIONS.USERS]: [{ key: { email: 1 }, name: 'email', unique: true }],
  [COLLECTIONS.API_VERSIONS]: [{ key: { service: 1 }, name: 'service', unique: true }],
};

export async function ensureIndexes(db: Db): Promise<void> {
  for (const [collectionName, indexes] of Object.entries(INDEXES)) {
    const collection = db.collection(collectionName);
    for (const index of indexes) {
      await collection.createIndex(index.key, {
        name: index.name,
        unique: index.unique,
        background: true,
      });
    }
  }
}
