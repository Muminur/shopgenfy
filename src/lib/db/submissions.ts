import { ObjectId, Db, WithId, Document } from 'mongodb';
import { COLLECTIONS } from './collections';
import {
  SubmissionInput,
  SubmissionUpdate,
  createSubmissionSchema,
} from '../validators/submission';

export interface SubmissionDocument {
  _id: ObjectId;
  userId: string;
  appName: string;
  appIntroduction: string;
  appDescription: string;
  featureList: string[];
  languages: string[];
  worksWith: string[];
  primaryCategory?: string; // Optional for draft mode
  secondaryCategory?: string;
  featureTags: string[];
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'subscription';
    price?: number;
    currency?: string;
    billingCycle?: 'monthly' | 'yearly' | 'one-time';
    trialDays?: number;
  };
  landingPageUrl?: string; // Optional for draft mode
  status: 'draft' | 'complete' | 'exported';
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function toSubmission(doc: WithId<Document>): SubmissionDocument {
  return {
    _id: doc._id as ObjectId,
    userId: doc.userId as string,
    appName: doc.appName as string,
    appIntroduction: doc.appIntroduction as string,
    appDescription: doc.appDescription as string,
    featureList: doc.featureList as string[],
    languages: doc.languages as string[],
    worksWith: doc.worksWith as string[],
    primaryCategory: doc.primaryCategory as string | undefined,
    secondaryCategory: doc.secondaryCategory as string | undefined,
    featureTags: doc.featureTags as string[],
    pricing: doc.pricing as SubmissionDocument['pricing'],
    landingPageUrl: doc.landingPageUrl as string | undefined,
    status: doc.status as SubmissionDocument['status'],
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  };
}

export async function createSubmission(
  db: Db,
  userId: string,
  data: SubmissionInput
): Promise<SubmissionDocument> {
  const validated = createSubmissionSchema.parse(data);
  const now = new Date();

  const doc: Omit<SubmissionDocument, '_id'> = {
    userId,
    ...validated,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const collection = db.collection(COLLECTIONS.SUBMISSIONS);
  const result = await collection.insertOne(doc);

  return {
    _id: result.insertedId,
    ...doc,
  };
}

export async function getSubmissionById(db: Db, id: string): Promise<SubmissionDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.SUBMISSIONS);
  const doc = await collection.findOne({ _id: new ObjectId(id) });

  return doc ? toSubmission(doc) : null;
}

export async function getSubmissionsByUserId(
  db: Db,
  userId: string,
  options: PaginationOptions = {}
): Promise<{ submissions: SubmissionDocument[]; total: number }> {
  const { page = 1, limit = 10, sortBy = 'updatedAt', sortOrder = 'desc' } = options;

  const collection = db.collection(COLLECTIONS.SUBMISSIONS);
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 } as const;

  const [submissions, total] = await Promise.all([
    collection.find({ userId }).sort(sort).skip(skip).limit(limit).toArray(),
    collection.countDocuments({ userId }),
  ]);

  return {
    submissions: submissions.map(toSubmission),
    total,
  };
}

export async function updateSubmission(
  db: Db,
  id: string,
  data: SubmissionUpdate
): Promise<SubmissionDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.SUBMISSIONS);
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...data,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  return result ? toSubmission(result) : null;
}

export async function deleteSubmission(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = db.collection(COLLECTIONS.SUBMISSIONS);
  const result = await collection.deleteOne({ _id: new ObjectId(id) });

  return result.deletedCount === 1;
}

export async function updateSubmissionStatus(
  db: Db,
  id: string,
  status: SubmissionDocument['status']
): Promise<SubmissionDocument | null> {
  return updateSubmission(db, id, { status } as SubmissionUpdate);
}
