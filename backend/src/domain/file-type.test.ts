import { describe, expect, it } from "vitest";
import { sniffDocumentMime } from "./file-type.js";

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("sniffDocumentMime", () => {
  it("recognises PDF, JPEG, PNG, WebP and HEIC", () => {
    expect(sniffDocumentMime(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffDocumentMime(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffDocumentMime(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffDocumentMime(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
    expect(sniffDocumentMime(bytes([0, 0, 0, 24], "ftypheic"))).toBe("image/heic");
  });

  it("rejects anything else (e.g. HTML renamed to .pdf)", () => {
    expect(sniffDocumentMime(bytes("<html><script>"))).toBeNull();
    expect(sniffDocumentMime(new Uint8Array())).toBeNull();
  });
});
