import { describe, expect, it } from "vitest";
import { earliestExpiry, photoErrorMessage, photoSlotsLeft, refreshDelay } from "./place-photos";
import { canAddPlacePhoto, canDeletePlacePhoto } from "./permissions";

describe("photoErrorMessage", () => {
  it("maps the backend codes to Thai", () => {
    expect(photoErrorMessage("unsupported_file_type")).toContain("JPEG");
    expect(photoErrorMessage("file_too_large")).toContain("10 MB");
    expect(photoErrorMessage("photo_limit")).toContain("10 รูป");
    expect(photoErrorMessage("file_required")).toBeTruthy();
    expect(photoErrorMessage("rate_limited")).toContain("บ่อยเกินไป");
  });
  it("falls back to the backend message, then a generic one", () => {
    expect(photoErrorMessage("weird", "ข้อความจาก backend")).toBe("ข้อความจาก backend");
    expect(photoErrorMessage("weird")).toContain("ไม่สำเร็จ");
  });
});

describe("photoSlotsLeft", () => {
  it("counts saved and in-flight photos against 10", () => {
    expect(photoSlotsLeft(0, 0)).toBe(10);
    expect(photoSlotsLeft(7, 2)).toBe(1);
    expect(photoSlotsLeft(10, 0)).toBe(0);
    expect(photoSlotsLeft(9, 5)).toBe(0);
  });
});

describe("url expiry", () => {
  const photos = [{ urlExpiresAt: "2026-01-01T00:15:00.000Z" }, { urlExpiresAt: "2026-01-01T00:10:00.000Z" }];
  const t0 = Date.parse("2026-01-01T00:00:00.000Z");
  it("finds the soonest expiry", () => {
    expect(earliestExpiry(photos)).toBe(Date.parse("2026-01-01T00:10:00.000Z"));
    expect(earliestExpiry([])).toBeNull();
  });
  it("refreshes one minute early, immediately once due", () => {
    expect(refreshDelay(photos, t0)).toBe(9 * 60_000);
    expect(refreshDelay(photos, t0 + 20 * 60_000)).toBe(0);
    expect(refreshDelay([], t0)).toBeNull();
  });
});

describe("photo permissions", () => {
  it("owner and editor add; viewer does not", () => {
    expect(canAddPlacePhoto({ id: "m1", role: "owner" })).toBe(true);
    expect(canAddPlacePhoto({ id: "m2", role: "editor" })).toBe(true);
    expect(canAddPlacePhoto({ id: "m3", role: "viewer" })).toBe(false);
  });
  it("owner deletes any; editor only their own; viewer none", () => {
    const photo = { uploadedBy: "m2" };
    expect(canDeletePlacePhoto({ id: "m1", role: "owner" }, photo)).toBe(true);
    expect(canDeletePlacePhoto({ id: "m2", role: "editor" }, photo)).toBe(true);
    expect(canDeletePlacePhoto({ id: "m4", role: "editor" }, photo)).toBe(false);
    expect(canDeletePlacePhoto({ id: "m2", role: "viewer" }, photo)).toBe(false);
  });
});
