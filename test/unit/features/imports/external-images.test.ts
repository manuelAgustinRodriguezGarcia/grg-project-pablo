import { describe, expect, it } from "vitest";
import {
  hasAttachedZip,
  type ExternalImageSelection,
  type StagedExternalImagesSummary,
} from "@/features/imports/utils/external-images";

describe("hasAttachedZip", () => {
  const emptySelection: ExternalImageSelection = {
    zipFile: null,
    imageFiles: [],
  };

  it("devuelve true si hay un ZIP en la selección actual", () => {
    const selection: ExternalImageSelection = {
      zipFile: new File(["zip"], "imagenes.zip", { type: "application/zip" }),
      imageFiles: [],
    };

    expect(hasAttachedZip(selection, null)).toBe(true);
  });

  it("devuelve true si el ZIP ya quedó registrado en el resumen del job", () => {
    const summary: StagedExternalImagesSummary = {
      sources: [{ name: "imagenes.zip", sizeBytes: 1024, kind: "zip" }],
      imageCount: 12,
    };

    expect(hasAttachedZip(emptySelection, summary)).toBe(true);
  });

  it("devuelve false si solo hay imágenes sueltas sin ZIP", () => {
    const selection: ExternalImageSelection = {
      zipFile: null,
      imageFiles: [new File(["img"], "foto.jpg", { type: "image/jpeg" })],
    };
    const summary: StagedExternalImagesSummary = {
      sources: [{ name: "foto.jpg", sizeBytes: 512, kind: "image" }],
      imageCount: 1,
    };

    expect(hasAttachedZip(selection, summary)).toBe(false);
  });

  it("devuelve false sin ZIP ni resumen", () => {
    expect(hasAttachedZip(emptySelection, null)).toBe(false);
  });
});
