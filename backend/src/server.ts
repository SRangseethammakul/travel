import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { closeDb, connectDb } from "./db/client.js";
import { ensureSchema } from "./db/schema.js";

const config = loadConfig();
const db = await connectDb(config.MONGODB_URI);
await ensureSchema(db);

const server = createApp(config).listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => void closeDb().then(() => process.exit(0)));
  });
}
