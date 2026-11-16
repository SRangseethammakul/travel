import { describe, expect, it } from "vitest";
import { fitWithin, jpegName, prepareImageForUpload, type ResizeDeps } from "./image-resize";

const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

function deps(over: Partial<ResizeDeps> & { dims?: [number, number]; out?: number | null } = {}): ResizeDeps & { sizes: unknown[]; closed: number } {
  const state = { sizes: [] as unknown[], closed: 0 };
  const [w, h] = over.dims ?? [4000, 3000];
  return {
    ...state,
    get sizes() {
      return state.sizes;
    },
    get closed() {
      return state.closed;
    },
    decode: over.decode ?? (async () => ({ width: w, height: h, source: {}, close: () => void state.closed++ })),
    encode:
      over.encode ??
      (async (_d, size) => {
        state.sizes.push(size);
        return over.out === null ? null : new Blob([new Uint8Array(over.out ?? 1000)], { type: "image/jpeg" });
      }),
    makeFile: over.makeFile ?? ((blob, name) => new File([blob], name, { type: "image/jpeg" })),
  };
}

describe("fitWithin", () => {
  it("scales the longest side down to 1600", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it("never enlarges", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });
  it("keeps at least 1px on extreme panoramas", () => {
    expect(fitWithin(32000, 10)).toEqual({ width: 1600, height: 1 });
  });
});

describe("jpegName", () => {
  it("swaps the extension", () => {
    expect(jpegName("IMG_0012.HEIC")).toBe("IMG_0012.jpg");
    expect(jpegName("a.b.png")).toBe("a.b.jpg");
    expect(jpegName("noext")).toBe("noext.jpg");
    expect(jpegName(".png")).toBe("photo.jpg");
  });
});

describe("prepareImageForUpload", () => {
  it("resizes a big photo to a JPEG", async () => {
    const d = deps();
    const out = await prepareImageForUpload(file("a.heic", "image/heic", 5_000_000), d);
    expect(out.name).toBe("a.jpg");
    expect(out.type).toBe("image/jpeg");
    expect(d.sizes).toEqual([{ width: 1600, height: 1200 }]);
    expect(d.closed).toBe(1);
  });
  it("uploads the original when decoding fails (HEIC on Chrome)", async () => {
    const original = file("a.heic", "image/heic", 100);
    const out = await prepareImageForUpload(original, deps({ decode: async () => Promise.reject(new Error("nope")) }));
    expect(out).toBe(original);
  });
  it("uploads the original when encoding fails", async () => {
    const original = file("a.png", "image/png", 100);
    expect(await prepareImageForUpload(original, deps({ out: null }))).toBe(original);
  });
  it("keeps a small JPEG that re-encoding would not shrink", async () => {
    const original = file("a.jpg", "image/jpeg", 500);
    expect(await prepareImageForUpload(original, deps({ dims: [800, 600], out: 900 }))).toBe(original);
  });
  it("re-encodes a small PNG as JPEG", async () => {
    const out = await prepareImageForUpload(file("a.png", "image/png", 5000), deps({ dims: [800, 600], out: 900 }));
    expect(out.name).toBe("a.jpg");
  });
});
