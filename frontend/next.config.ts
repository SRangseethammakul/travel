import type { NextConfig } from "next";

// Same default as src/lib/api/backend-url.ts. Read inline (not imported) because
// `next start` loads this file at runtime and the Docker image ships no src/.
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");

// cacheComponents / partialPrefetching (create-next-app defaults) are turned off:
// every trip page depends on the signed-in User's cookies (forwarded to the
// backend, docs/adr/0001), so plain dynamic rendering + Server Actions →
// revalidatePath is the model we use.
const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dev only: lets a phone/tablet on the LAN (http://192.168.x.x:3000) load the
  // dev runtime. Without it Next 16 blocks /_next/webpack-hmr and the page never
  // becomes interactive — links work, buttons don't.
  allowedDevOrigins: ["192.168.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Slips / documents go through Server Actions: backend limit 10 MB + multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
  // One origin for the browser (docs/adr/0001): OAuth start/callback, signed file
  // URLs and the `session` cookie all live under /api on the web domain.
  // Resolved at build time — BACKEND_URL must be set for `next build` too.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
