import { ObjectId, Db, WithId, Document } from 'mongodb';
import { COLLECTIONS } from './collections';
import { CreateUserInput, UpdateUserInput, createUserSchema } from '../validators/user';

export interface UserDocument {
  _id: ObjectId;
  email: string;
  selectedGeminiModel: string;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toUser(doc: WithId<Document>): UserDocument {
  return {
    _id: doc._id as ObjectId,
    email: doc.email as string,
    selectedGeminiModel: doc.selectedGeminiModel as string,
    theme: doc.theme as UserDocument['theme'],
    autoSave: (doc.autoSave as boolean) ?? true,
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
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.USERS);
  const doc = await collection.findOne({ _id: new ObjectId(id) });

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
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.USERS);
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

  return result ? toUser(result) : null;
}

export async function deleteUser(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = db.collection(COLLECTIONS.USERS);
  const result = await collection.deleteOne({ _id: new ObjectId(id) });

  return result.deletedCount === 1;
}

export async function getOrCreateUser(db: Db, email: string): Promise<UserDocument> {
  const existing = await getUserByEmail(db, email);
  if (existing) {
    return existing;
  }

  return createUser(db, {
    email,
    selectedGeminiModel: 'gemini-pro',
    theme: 'light',
    autoSave: true,
  });
}
