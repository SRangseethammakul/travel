import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const valid = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/travel-planner",
  NODE_ENV: "development",
  SESSION_SECRET: "x".repeat(32),
  FILE_URL_SECRET: "y".repeat(32),
  CORS_ORIGIN: "http://localhost:3000",
};

describe("loadConfig", () => {
  it("accepts a valid env and fills defaults", () => {
    const config = loadConfig(valid);
    expect(config.PORT).toBe(4000);
    expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("stops on a missing or weak value", () => {
    expect(() => loadConfig({ ...valid, MONGODB_URI: undefined })).toThrow(/MONGODB_URI/);
    expect(() => loadConfig({ ...valid, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });

  it("treats empty optional values as unset", () => {
    expect(loadConfig({ ...valid, LINE_CHANNEL_ID: "" }).LINE_CHANNEL_ID).toBeUndefined();
  });
});
