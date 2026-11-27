/** `npm run seed` — reset the dev database to the 4 seed trips. */
import { loadConfig } from "../config.js";
import { closeDb, connectDb } from "../db/client.js";
import { ensureSchema } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { seed } from "./seed.js";

const config = loadConfig();
if (config.NODE_ENV === "production") throw new Error("Refusing to seed a production database");
const db = await connectDb(config.MONGODB_URI);
try {
  await ensureSchema(db);
  await seed(db);
  logger.info("Seeded 4 trips");
} finally {
  await closeDb();
}
