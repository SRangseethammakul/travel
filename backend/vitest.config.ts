import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // First run downloads the mongod binary for mongodb-memory-server.
    hookTimeout: 120_000,
  },
});
