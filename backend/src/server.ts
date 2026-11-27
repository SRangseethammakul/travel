import { createApp } from "./app.js";
import { loadConfig } from "./config/config.js";
import { closeDb, connectDb } from "./db/client.js";
import { ensureSchema } from "./db/schema.js";
import { logger } from "./utils/logger.js";

const config = loadConfig();
const db = await connectDb(config.MONGODB_URI);
await ensureSchema(db);

const server = createApp(config).listen(config.PORT, () => {
  logger.info(`API listening on http://localhost:${config.PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => void closeDb().then(() => process.exit(0)));
  });
}
