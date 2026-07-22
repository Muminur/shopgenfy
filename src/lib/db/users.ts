import { ObjectId, Db, WithId, Document, Filter } from 'mongodb';
import { COLLECTIONS } from './collections';
import {
  CreateUserInput,
  UpdateUserInput,
  ScreenshotSource,
  createUserSchema,
} from '../validators/user';

export interface UserDocument {
  // Users are keyed by an anonymous client string id (`user-<uuid>`). Legacy
  // documents may still carry an ObjectId `_id`, so both are supported.
  _id: string | ObjectId;
  email?: string;
  selectedGeminiModel: string;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  screenshotSource: ScreenshotSource;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Build a filter that matches a user by id whether the document is keyed by a
 * client string (`user-<uuid>`) or a legacy ObjectId. A 24-hex string is a
 * valid ObjectId, so we match either representation; anything else is treated
 * as a plain string key.
 */
function buildIdFilter(id: string): Filter<Document> {
  if (ObjectId.isValid(id)) {
    return { _id: { $in: [id, new ObjectId(id)] } } as unknown as Filter<Document>;
  }
  return { _id: id } as unknown as Filter<Document>;
}

function toUser(doc: WithId<Document>): UserDocument {
  return {
    _id: doc._id as string | ObjectId,
    email: doc.email as string | undefined,
    selectedGeminiModel: doc.selectedGeminiModel as string,
    theme: doc.theme as UserDocument['theme'],
    autoSave: (doc.autoSave as boolean) ?? true,
    screenshotSource: (doc.screenshotSource as ScreenshotSource) ?? 'website',
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  };
}

export async function createUser(db: Db, data: CreateUserInput): Promise<UserDocument> {
  const validated = createUserSchema.parse(data);
  const now = new Date();

  const doc: Omit<UserDocument, '_id'> = {
    ...validated,
    createdAt: now,
    updatedAt: now,
  };

  const collection = db.collection(COLLECTIONS.USERS);
  const result = await collection.insertOne(doc);

  return {
    _id: result.insertedId,
    ...doc,
  };
}

export async function getUserById(db: Db, id: string): Promise<UserDocument | null> {
  const collection = db.collection(COLLECTIONS.USERS);
  const doc = await collection.findOne(buildIdFilter(id));

  return doc ? toUser(doc) : null;
}

export async function getUserByEmail(db: Db, email: string): Promise<UserDocument | null> {
  const collection = db.collection(COLLECTIONS.USERS);
  const doc = await collection.findOne({ email });

  return doc ? toUser(doc) : null;
}

export async function updateUser(
  db: Db,
  id: string,
  data: UpdateUserInput
): Promise<UserDocument | null> {
  const collection = db.collection(COLLECTIONS.USERS);
  const result = await collection.findOneAndUpdate(
    buildIdFilter(id),
    {
      $set: {
        ...data,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  return result ? toUser(result) : null;
}

export async function deleteUser(db: Db, id: string): Promise<boolean> {
  const collection = db.collection(COLLECTIONS.USERS);
  const result = await collection.deleteOne(buildIdFilter(id));

  return result.deletedCount === 1;
}

/**
 * Upsert a user keyed by the client string id. No email is required — the id is
 * the identity. New users get the app defaults; existing users are returned
 * untouched.
 */
export async function getOrCreateUser(db: Db, userId: string): Promise<UserDocument> {
  const collection = db.collection(COLLECTIONS.USERS);
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { _id: userId } as unknown as Filter<Document>,
    {
      $setOnInsert: {
        selectedGeminiModel: 'auto',
        theme: 'system',
        screenshotSource: 'website',
        autoSave: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!result) {
    // With upsert:true + returnDocument:'after' this should never be null, but
    // fall back to a direct read to stay type-safe.
    const doc = await collection.findOne({ _id: userId } as unknown as Filter<Document>);
    if (!doc) {
      throw new Error('Failed to upsert user');
    }
    return toUser(doc);
  }

  return toUser(result);
}
