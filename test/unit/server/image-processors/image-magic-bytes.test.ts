import { describe, expect, it } from "vitest";
import {
  isSharpLoadError,
  validateImageMagicBytes,
} from "@/server/image-processors/image-magic-bytes";

describe("validateImageMagicBytes", () => {
  it("detecta JPEG", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(validateImageMagicBytes(buffer)).toEqual({
      valid: true,
      mimeType: "image/jpeg",
      format: "jpeg",
    });
  });

  it("detecta PNG", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(validateImageMagicBytes(buffer)).toEqual({
      valid: true,
      mimeType: "image/png",
      format: "png",
    });
  });

  it("rechaza buffers vacíos o desconocidos", () => {
    expect(validateImageMagicBytes(Buffer.alloc(0))).toEqual({
      valid: false,
      error: "Imagen dañada o inválida.",
    });
    expect(validateImageMagicBytes(Buffer.from("not-an-image"))).toEqual({
      valid: false,
      error: "Formato no soportado.",
    });
  });
});

describe("isSharpLoadError", () => {
  it("detecta errores de carga de sharp", () => {
    expect(
      isSharpLoadError(new Error("Failed to load external module sharp-abc")),
    ).toBe(true);
    expect(isSharpLoadError(new Error("ERR_DLOPEN_FAILED"))).toBe(true);
    expect(isSharpLoadError(new Error("Imagen corrupta"))).toBe(false);
  });
});
