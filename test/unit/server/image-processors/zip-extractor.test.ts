import { describe, expect, it } from "vitest";
import { isSafeZipEntryPath } from "@/server/image-processors/zip-extractor";

describe("zip-extractor", () => {
  it("rechaza rutas con path traversal", () => {
    expect(isSafeZipEntryPath("../secret.jpg")).toBe(false);
    expect(isSafeZipEntryPath("folder/../../etc/passwd")).toBe(false);
  });

  it("acepta imágenes con extensión permitida", () => {
    expect(isSafeZipEntryPath("imagenes/PLACA-001.jpg")).toBe(true);
    expect(isSafeZipEntryPath("foto.PNG")).toBe(true);
  });

  it("rechaza extensiones no permitidas", () => {
    expect(isSafeZipEntryPath("macro.vbs")).toBe(false);
    expect(isSafeZipEntryPath("documento.pdf")).toBe(false);
  });
});
