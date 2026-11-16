import { describe, expect, it } from "vitest";
import { clipboardImageFiles, pastedImageFiles, type ClipboardItemLike } from "./place-photos";

const item = (types: string[]): ClipboardItemLike => ({
  types,
  getType: async (type) => new Blob(["x"], { type }),
});

describe("clipboardImageFiles", () => {
  it("takes the first image type of each item and skips text-only items", async () => {
    const files = await clipboardImageFiles([item(["image/png", "image/jpeg"]), item(["text/plain"]), item(["text/html", "image/jpeg"])], 1);
    expect(files.map((f) => [f.name, f.type])).toEqual([
      ["pasted-1-1.png", "image/png"],
      ["pasted-1-2.jpg", "image/jpeg"],
    ]);
  });

  it("returns nothing when the clipboard has no image", async () => {
    expect(await clipboardImageFiles([item(["text/plain"])])).toEqual([]);
  });
});

describe("pastedImageFiles", () => {
  it("keeps only images", () => {
    const img = new File(["a"], "a.png", { type: "image/png" });
    const pdf = new File(["b"], "b.pdf", { type: "application/pdf" });
    expect(pastedImageFiles([img, pdf])).toEqual([img]);
  });
});
