import { MongoClient, Db } from 'mongodb';

function getMongoConfig() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  if (!MONGODB_DB_NAME) {
    throw new Error('MONGODB_DB_NAME environment variable is not defined');
  }

  return { MONGODB_URI, MONGODB_DB_NAME };
}

const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  var _mongoClient: MongoClient | undefined;

  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function getMongoClient(): MongoClient {
  const { MONGODB_URI } = getMongoConfig();

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClient) {
      global._mongoClient = new MongoClient(MONGODB_URI, options);
    }
    return global._mongoClient;
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI, options);
  }
  return client;
}

export async function connectToDatabase(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const client = getMongoClient();
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    const mongoClient = getMongoClient();
    clientPromise = mongoClient.connect();
  }
  return clientPromise;
}

export function getDatabase(): Db {
  const { MONGODB_DB_NAME } = getMongoConfig();
  const mongoClient = getMongoClient();
  return mongoClient.db(MONGODB_DB_NAME);
}

export async function getDatabaseConnected(): Promise<Db> {
  const { MONGODB_DB_NAME } = getMongoConfig();
  const mongoClient = await connectToDatabase();
  return mongoClient.db(MONGODB_DB_NAME);
}

export async function closeDatabaseConnection(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    if (global._mongoClient) {
      await global._mongoClient.close();
      global._mongoClient = undefined;
      global._mongoClientPromise = undefined;
    }
  } else {
    if (client) {
      await client.close();
      client = null;
      clientPromise = null;
    }
  }
}
