import { describe, expect, it, vi } from "vitest";
import {
  extractImagesFromZip,
  MAX_ENTRY_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  ZipExtractionError,
} from "@/server/image-processors/zip-extractor";

describe("zip-extractor limits", () => {
  it("rechaza ZIP con demasiadas entradas", async () => {
    const unzipper = await import("unzipper");
    const directory = {
      files: Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, index) => ({
        type: "File",
        path: `image-${index}.jpg`,
        uncompressedSize: 100,
        buffer: async () => Buffer.alloc(100),
      })),
    };

    const openSpy = vi.spyOn(unzipper.default.Open, "buffer").mockResolvedValue(
      directory as never,
    );

    await expect(extractImagesFromZip(Buffer.from("zip"))).rejects.toBeInstanceOf(
      ZipExtractionError,
    );
    await expect(extractImagesFromZip(Buffer.from("zip"))).rejects.toThrow(
      `El ZIP supera el máximo de ${MAX_ZIP_ENTRIES} imágenes.`,
    );

    openSpy.mockRestore();
  });

  it("rechaza entradas que superan el tamaño máximo por imagen", async () => {
    const unzipper = await import("unzipper");
    const openSpy = vi.spyOn(unzipper.default.Open, "buffer").mockResolvedValue({
      files: [
        {
          type: "File",
          path: "huge.jpg",
          uncompressedSize: MAX_ENTRY_BYTES + 1,
          buffer: async () => Buffer.alloc(MAX_ENTRY_BYTES + 1),
        },
      ],
    } as never);

    await expect(extractImagesFromZip(Buffer.from("zip"))).rejects.toThrow(
      "supera el tamaño máximo permitido por imagen",
    );

    openSpy.mockRestore();
  });

  it("rechaza contenido descomprimido acumulado excesivo", async () => {
    const unzipper = await import("unzipper");
    const entryCount = Math.floor(MAX_UNCOMPRESSED_BYTES / MAX_ENTRY_BYTES) + 1;
    const openSpy = vi.spyOn(unzipper.default.Open, "buffer").mockResolvedValue({
      files: Array.from({ length: entryCount }, (_, index) => ({
        type: "File",
        path: `image-${index}.jpg`,
        uncompressedSize: MAX_ENTRY_BYTES,
        buffer: async () => Buffer.alloc(100),
      })),
    } as never);

    await expect(extractImagesFromZip(Buffer.from("zip"))).rejects.toThrow(
      "contenido descomprimido del ZIP supera el límite",
    );

    openSpy.mockRestore();
  });
});
