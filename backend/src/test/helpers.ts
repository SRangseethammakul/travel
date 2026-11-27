/**
 * Test helper: one mongodb-memory-server per test file, schema + 4 seed trips.
 * Usage in a test file:
 *   const db = useTestDb();          // registers beforeAll/afterAll
 *   const app = () => createApp(testConfig);
 *   await request(app()).get("/api/me").set(as("act"));
 *   await db.reseed();               // in beforeEach when a test writes
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll } from "vitest";
import type { Config } from "../config/config.js";
import { closeDb, connectDb, getDb } from "../db/client.js";
import { ensureSchema } from "../db/schema.js";
import { seed } from "../seed/seed.js";

/** Fixed clock for the seed (relative timestamps like "1 hour ago"). */
export const TEST_NOW = new Date("2026-11-11T12:00:00.000Z");

export const testConfig: Config = {
  MONGODB_URI: "mongodb://unused-in-tests",
  PORT: 0,
  NODE_ENV: "test",
  SESSION_SECRET: "test-session-secret-test-session-secret",
  FILE_URL_SECRET: "test-file-url-secret-test-file-url-secret",
  CORS_ORIGIN: "http://localhost:3000",
  PUBLIC_API_URL: "http://localhost:4000",
  UPLOAD_DIR: ".data/test-uploads",
  STORAGE_DRIVER: "local",
  S3_REGION: "us-east-1",
  TRUST_PROXY: 0,
  ADMIN_USER_IDS: [],
};

/** Request header that signs in as a seed User (`act`, `mint`, `beam`, `ploy`, `n`). */
export const as = (userId: string) => ({ Cookie: `mock-user=${userId}` });

export function useTestDb() {
  let mongod: MongoMemoryServer | undefined;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const db = await connectDb(mongod.getUri("travel-planner-test"));
    await ensureSchema(db);
    await seed(db, TEST_NOW);
  });
  afterAll(async () => {
    await closeDb();
    await mongod?.stop();
  });
  return {
    db: () => getDb(),
    reseed: () => seed(getDb(), TEST_NOW),
  };
}
