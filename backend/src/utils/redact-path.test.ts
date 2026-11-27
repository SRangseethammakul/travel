import { describe, expect, it } from "vitest";
import { redactPath } from "./redact-path.js";

describe("redactPath", () => {
  it("replaces the invite token", () => {
    expect(redactPath("/api/join/abc123")).toBe("/api/join/:token");
  });
  it("keeps a trailing slash or further segments", () => {
    expect(redactPath("/api/join/abc123/")).toBe("/api/join/:token/");
    expect(redactPath("/api/join/abc123/extra")).toBe("/api/join/:token/extra");
  });
  it("drops the query string", () => {
    expect(redactPath("/api/join/abc123?x=1")).toBe("/api/join/:token");
    expect(redactPath("/api/files/d1?exp=1&sig=zz")).toBe("/api/files/d1");
  });
  it("matches case-insensitively", () => {
    expect(redactPath("/API/JOIN/abc123")).toBe("/API/JOIN/:token");
  });
  it("leaves other paths unchanged", () => {
    for (const p of ["/api/trips/tokyo-winter", "/api/join", "/api/join/", "/api/admin/system", "/x/api/join/abc"]) {
      expect(redactPath(p)).toBe(p);
    }
  });
});
