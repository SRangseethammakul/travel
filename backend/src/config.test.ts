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

  it("needs TRUST_PROXY ≥ 1 in production (else every client shares Next's IP for the OAuth limit)", () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: "production" })).toThrow(/TRUST_PROXY/);
    expect(loadConfig({ ...valid, NODE_ENV: "production", TRUST_PROXY: "1" }).TRUST_PROXY).toBe(1);
    expect(loadConfig(valid).TRUST_PROXY).toBe(0);
  });

  it("treats empty optional values as unset", () => {
    expect(loadConfig({ ...valid, LINE_CHANNEL_ID: "" }).LINE_CHANNEL_ID).toBeUndefined();
  });

  it("defaults to local storage and needs every S3 value when STORAGE_DRIVER=s3", () => {
    expect(loadConfig(valid).STORAGE_DRIVER).toBe("local");
    expect(loadConfig({ ...valid, S3_BUCKET: "" }).S3_BUCKET).toBeUndefined();
    expect(() => loadConfig({ ...valid, STORAGE_DRIVER: "s3" })).toThrow(/S3_BUCKET/);
    const s3 = {
      ...valid,
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "https://sgp1.digitaloceanspaces.com",
      S3_BUCKET: "trips",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    };
    expect(loadConfig(s3).S3_REGION).toBe("us-east-1");
    expect(() => loadConfig({ ...s3, S3_SECRET_ACCESS_KEY: "" })).toThrow(/S3_SECRET_ACCESS_KEY/);
    expect(() => loadConfig({ ...s3, STORAGE_DRIVER: "gcs" })).toThrow(/STORAGE_DRIVER/);
  });
});
