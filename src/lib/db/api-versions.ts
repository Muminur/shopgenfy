import { ObjectId, Db, WithId, Document } from 'mongodb';
import { COLLECTIONS } from './collections';

export interface APIVersionDocument {
  _id: ObjectId;
  service: 'gemini' | 'nanobanana';
  currentVersion: string;
  lastKnownGood: string;
  availableVersions: string[];
  lastChecked: Date;
}

export interface CreateAPIVersionInput {
  service: 'gemini' | 'nanobanana';
  currentVersion: string;
  lastKnownGood: string;
  availableVersions: string[];
}

export interface UpdateAPIVersionInput {
  currentVersion?: string;
  lastKnownGood?: string;
  availableVersions?: string[];
}

function toAPIVersionDocument(doc: WithId<Document>): APIVersionDocument {
  return {
    _id: doc._id as ObjectId,
    service: doc.service as 'gemini' | 'nanobanana',
    currentVersion: doc.currentVersion as string,
    lastKnownGood: doc.lastKnownGood as string,
    availableVersions: doc.availableVersions as string[],
    lastChecked: doc.lastChecked as Date,
  };
}

export async function createAPIVersion(
  db: Db,
  input: CreateAPIVersionInput
): Promise<APIVersionDocument> {
  const collection = db.collection(COLLECTIONS.API_VERSIONS);

  const document = {
    ...input,
    lastChecked: new Date(),
  };

  const result = await collection.insertOne(document);

  return {
    _id: result.insertedId,
    ...document,
  };
}

export async function getAPIVersionById(db: Db, id: string): Promise<APIVersionDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.API_VERSIONS);
  const doc = await collection.findOne({ _id: new ObjectId(id) });

  if (!doc) {
    return null;
  }

  return toAPIVersionDocument(doc);
}

export async function getAPIVersionByService(
  db: Db,
  service: 'gemini' | 'nanobanana'
): Promise<APIVersionDocument | null> {
  const collection = db.collection(COLLECTIONS.API_VERSIONS);
  const doc = await collection.findOne({ service });

  if (!doc) {
    return null;
  }

  return toAPIVersionDocument(doc);
}

export async function getAllAPIVersions(db: Db): Promise<APIVersionDocument[]> {
  const collection = db.collection(COLLECTIONS.API_VERSIONS);
  const docs = await collection.find({}).sort({ service: 1 }).toArray();

  return docs.map(toAPIVersionDocument);
}

export async function updateAPIVersion(
  db: Db,
  id: string,
  update: UpdateAPIVersionInput
): Promise<APIVersionDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.API_VERSIONS);

  const updateDoc = {
    ...update,
    lastChecked: new Date(),
  };

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updateDoc },
    { returnDocument: 'after' }
  );

  if (!result) {
    return null;
  }

  return toAPIVersionDocument(result);
}

export async function deleteAPIVersion(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = db.collection(COLLECTIONS.API_VERSIONS);
  const result = await collection.deleteOne({ _id: new ObjectId(id) });

  return result.deletedCount === 1;
}
