import 'server-only';

import { MongoClient, type Db } from 'mongodb';

declare global {
  // eslint-disable-next-line no-var
  var __mongoClient: MongoClient | undefined;
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'demonstrator';

export function isMongoConfigured(): boolean {
  return Boolean(uri?.trim());
}

export async function getMongoDb(): Promise<Db> {
  if (!uri?.trim()) {
    throw new Error(
      'MONGODB_URI est requis. Ajoutez-le dans .env.local (ex. mongodb://localhost:27017).'
    );
  }

  if (!global.__mongoClient) {
    global.__mongoClient = new MongoClient(uri);
    await global.__mongoClient.connect();
  }

  return global.__mongoClient.db(dbName);
}
