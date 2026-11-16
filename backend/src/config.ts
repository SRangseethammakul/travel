import { z } from "zod";

const secret = z.string().min(32, "must be at least 32 characters");
/** Optional setting; an empty value in .env counts as unset. */
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const ConfigSchema = z
  .object({
  MONGODB_URI: z.string().startsWith("mongodb"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]),
  SESSION_SECRET: secret,
  FILE_URL_SECRET: secret,
  CORS_ORIGIN: z.url(),
  /** Public base URL the browser uses for this API (OAuth redirect URIs, signed file URLs) = the web origin; Next rewrites /api/* here (docs/adr/0001). */
  PUBLIC_API_URL: z.url().default("http://localhost:3000"),
  /**
   * How many reverse proxies in front of the backend append the client to X-Forwarded-For
   * (Express `trust proxy` hop count). 0 = trust none (dev / docker compose). Next's rewrites do
   * NOT count: Next passes X-Forwarded-For through unchanged, so a client could write it.
   * Behind one load balancer that appends the client IP (and the backend reachable only through
   * it and Next) use 1. Only the per-IP auth limiter depends on this.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  /** dev file storage for Documents (real object storage is undecided). */
  UPLOAD_DIR: z.string().min(1).default(".data/uploads"),
  /** Where Documents and Place photos live: local disk (dev, tests) or an S3-compatible bucket (DigitalOcean Spaces). */
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  /** e.g. https://sgp1.digitaloceanspaces.com. The four S3_* values below are required when STORAGE_DRIVER=s3. */
  S3_ENDPOINT: optional.pipe(z.url().optional()),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  // OAuth (phase 5). A provider without credentials is turned off (its routes answer 404).
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  LINE_CHANNEL_ID: optional,
  LINE_CHANNEL_SECRET: optional,
})
  .superRefine((c, ctx) => {
    if (c.STORAGE_DRIVER !== "s3") return;
    for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!c[key]) ctx.addIssue({ code: "custom", path: [key], message: "required when STORAGE_DRIVER=s3" });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;

/** Reads and validates env. Throws with every problem listed, so the server stops at startup. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
