import { describe, expect, it } from "vitest";
import {
  hasStagedExternalImagesSummary,
  snapshotExternalImageSources,
} from "@/features/imports/utils/external-images";

describe("snapshotExternalImageSources", () => {
  it("captura zip e imágenes sueltas", () => {
    const zip = new File([new Uint8Array([1, 2, 3])], "fotos.zip", {
      type: "application/zip",
    });
    const image = new File([new Uint8Array([4, 5])], "a.jpg", {
      type: "image/jpeg",
    });

    expect(
      snapshotExternalImageSources({
        zipFile: zip,
        imageFiles: [image],
      }),
    ).toEqual([
      { name: "fotos.zip", sizeBytes: 3, kind: "zip" },
      { name: "a.jpg", sizeBytes: 2, kind: "image" },
    ]);
  });
});

describe("hasStagedExternalImagesSummary", () => {
  it("detecta resúmenes con archivos o imágenes importadas", () => {
    expect(hasStagedExternalImagesSummary(null)).toBe(false);
    expect(
      hasStagedExternalImagesSummary({
        sources: [],
        imageCount: 0,
      }),
    ).toBe(false);
    expect(
      hasStagedExternalImagesSummary({
        sources: [{ name: "fotos.zip", sizeBytes: 10, kind: "zip" }],
        imageCount: 0,
      }),
    ).toBe(true);
    expect(
      hasStagedExternalImagesSummary({
        sources: [],
        imageCount: 3,
      }),
    ).toBe(true);
  });
});
