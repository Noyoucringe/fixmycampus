import { config } from 'dotenv'; config({ path: new URL('../../../.env', import.meta.url).pathname });
import { MongoClient, Db, GridFSBucket } from 'mongodb';

let client: MongoClient;
let db: Db;
let gridfs: GridFSBucket;

export async function connectDB(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  gridfs = new GridFSBucket(db, { bucketName: 'photos' });

  await db.command({ ping: 1 });
  console.log('Connected to MongoDB Atlas');
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected');
  return db;
}

export function getClient(): MongoClient {
  if (!client) throw new Error('Database not connected');
  return client;
}

export function getGridFS(): GridFSBucket {
  if (!gridfs) throw new Error('Database not connected');
  return gridfs;
}

