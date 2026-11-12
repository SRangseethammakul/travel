import { MongoClient, type Db } from "mongodb";

// One MongoClient per process. Driver pool defaults are kept on purpose: no load
// data yet to size the pool from (see the mongodb-connection guidance).
let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(uri: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(); // database name comes from the URI path
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Database not connected — call connectDb() first");
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
