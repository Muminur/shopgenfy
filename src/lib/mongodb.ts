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

// Connection options. `serverSelectionTimeoutMS` defaults to 5s so a dead DB
// fails fast instead of hanging 30s; it is env-overridable purely as a test
// seam (so the resilience test can reject in ~300ms).
function getMongoOptions() {
  return {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
  };
}

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
      global._mongoClient = new MongoClient(MONGODB_URI, getMongoOptions());
    }
    return global._mongoClient;
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI, getMongoOptions());
  }
  return client;
}

export async function connectToDatabase(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const devClient = getMongoClient();
      // On failure, drop the poisoned promise AND the client so the next
      // request retries with a fresh client (recovers when the DB comes back).
      global._mongoClientPromise = devClient.connect().catch((err) => {
        void devClient.close().catch(() => {});
        global._mongoClientPromise = undefined;
        global._mongoClient = undefined;
        throw err;
      });
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    const mongoClient = getMongoClient();
    clientPromise = mongoClient.connect().catch((err) => {
      void mongoClient.close().catch(() => {});
      clientPromise = null;
      client = null;
      throw err;
    });
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
