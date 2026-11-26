import { describe, expect, it } from "vitest";
import { flashFromCookieString, parseFlash, serializeFlash } from "./flash";

describe("flash cookie", () => {
  it("round-trips a message with a link, raw or URI-encoded", () => {
    const flash = { message: "บันทึกที่พักแล้ว", link: { href: "/trips/t1/expenses/e1/edit", label: "แก้การหาร" } };
    const raw = serializeFlash(flash);
    expect(parseFlash(raw)).toEqual(flash);
    expect(parseFlash(encodeURIComponent(raw))).toEqual(flash);
  });

  it("keeps the error tone", () => {
    expect(parseFlash(serializeFlash({ message: "ไม่สำเร็จ", tone: "error" }))).toEqual({ message: "ไม่สำเร็จ", tone: "error" });
  });

  it("drops malformed values and empty messages", () => {
    expect(parseFlash(undefined)).toBeNull();
    expect(parseFlash("")).toBeNull();
    expect(parseFlash("not json")).toBeNull();
    expect(parseFlash(JSON.stringify({ message: "  " }))).toBeNull();
    expect(parseFlash(JSON.stringify({ message: 5 }))).toBeNull();
  });

  it("drops links that leave the app", () => {
    for (const href of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
      expect(parseFlash(JSON.stringify({ message: "ok", link: { href, label: "ไป" } }))).toEqual({ message: "ok" });
    }
  });

  it("truncates a very long message", () => {
    expect(parseFlash(serializeFlash({ message: "ก".repeat(500) }))?.message).toHaveLength(200);
  });

  it("finds the flash in document.cookie", () => {
    const value = encodeURIComponent(serializeFlash({ message: "ลบแล้ว" }));
    expect(flashFromCookieString(`a=1; flash=${value}; b=2`)).toEqual({ message: "ลบแล้ว" });
    expect(flashFromCookieString("a=1; flashy=2")).toBeNull();
  });
});
