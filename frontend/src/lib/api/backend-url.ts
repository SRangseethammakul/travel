/**
 * Where the Next server reaches the backend (docs/adr/0001). Server-side only:
 * the browser always uses `/api/*` on the web origin, which next.config.ts
 * rewrites here. docker-compose sets `http://backend:4000`.
 */
export const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
