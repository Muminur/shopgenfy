import { ObjectId, Db, WithId, Document } from 'mongodb';
import { COLLECTIONS } from './collections';

export interface ImageDocument {
  _id: ObjectId;
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

export interface CreateImageInput {
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
}

export interface UpdateImageInput {
  driveFileId?: string;
  driveUrl?: string;
  generationPrompt?: string;
  altText?: string;
  version?: number;
}

export interface ImageFilterOptions {
  type?: 'icon' | 'feature';
}

function toImageDocument(doc: WithId<Document>): ImageDocument {
  return {
    _id: doc._id as ObjectId,
    submissionId: doc.submissionId as string,
    type: doc.type as 'icon' | 'feature',
    driveFileId: doc.driveFileId as string,
    driveUrl: doc.driveUrl as string,
    width: doc.width as number,
    height: doc.height as number,
    format: doc.format as 'png' | 'jpeg',
    generationPrompt: doc.generationPrompt as string,
    featureHighlighted: doc.featureHighlighted as string,
    altText: doc.altText as string,
    version: doc.version as number,
    createdAt: doc.createdAt as Date,
  };
}

export async function createGeneratedImage(
  db: Db,
  input: CreateImageInput
): Promise<ImageDocument> {
  const collection = db.collection(COLLECTIONS.GENERATED_IMAGES);

  const document = {
    ...input,
    createdAt: new Date(),
  };

  const result = await collection.insertOne(document);

  return {
    _id: result.insertedId,
    ...document,
  };
}

export async function getImageById(db: Db, id: string): Promise<ImageDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.GENERATED_IMAGES);
  const doc = await collection.findOne({ _id: new ObjectId(id) });

  if (!doc) {
    return null;
  }

  return toImageDocument(doc);
}

export async function getImagesBySubmissionId(
  db: Db,
  submissionId: string,
  options: ImageFilterOptions = {}
): Promise<ImageDocument[]> {
  const collection = db.collection(COLLECTIONS.GENERATED_IMAGES);

  const filter: Record<string, unknown> = { submissionId };
  if (options.type) {
    filter.type = options.type;
  }

  const docs = await collection.find(filter).sort({ createdAt: -1 }).toArray();

  return docs.map(toImageDocument);
}

export async function updateImage(
  db: Db,
  id: string,
  update: UpdateImageInput
): Promise<ImageDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = db.collection(COLLECTIONS.GENERATED_IMAGES);

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );

  if (!result) {
    return null;
  }

  return toImageDocument(result);
}

export async function deleteImage(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = db.collection(COLLECTIONS.GENERATED_IMAGES);
  const result = await collection.deleteOne({ _id: new ObjectId(id) });

  return result.deletedCount === 1;
}

export async function deleteImagesBySubmissionId(db: Db, submissionId: string): Promise<number> {
  const collection = db.collection(COLLECTIONS.GENERATED_IMAGES);
  const result = await collection.deleteMany({ submissionId });

  return result.deletedCount;
}
