import { describe, expect, it } from "vitest";
import { StorageValidationError } from "@/server/storage/errors";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { normalizeStoragePath, validateUpload } from "@/server/storage/validate";

const MB = 1024 * 1024;

describe("validateUpload", () => {
  it("rechaza un archivo vacío", () => {
    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.PRODUCT_IMAGES,
        Buffer.alloc(0),
        "image/jpeg",
        "foto.jpg",
      ),
    ).toThrow(StorageValidationError);
  });

  it("rechaza archivos que superan el límite del bucket", () => {
    const oversized = Buffer.alloc(11 * MB);

    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.PRODUCT_IMAGES,
        oversized,
        "image/jpeg",
        "foto.jpg",
      ),
    ).toThrow(/supera el límite de 10 MB/);
  });

  it("rechaza MIME no permitido", () => {
    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.PRODUCT_IMAGES,
        Buffer.from("data"),
        "application/pdf",
        "foto.jpg",
      ),
    ).toThrow(/Tipo MIME no permitido/);
  });

  it("rechaza extensiones no permitidas", () => {
    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.PRODUCT_IMAGES,
        Buffer.from("data"),
        "image/jpeg",
        "foto.gif",
      ),
    ).toThrow(/Extensión no permitida/);
  });

  it("acepta un upload válido en product-images", () => {
    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.PRODUCT_IMAGES,
        Buffer.from("jpeg-data"),
        "image/jpeg",
        "foto.jpg",
      ),
    ).not.toThrow();
  });

  it("acepta .xlsm con MIME en minúsculas (navegador)", () => {
    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.EXCEL_ORIGINALS,
        Buffer.from("xlsm-data"),
        "application/vnd.ms-excel.sheet.macroenabled.12",
        "catalogo.xlsm",
      ),
    ).not.toThrow();
  });

  it("acepta Uint8Array y ArrayBuffer", () => {
    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.EXCEL_ORIGINALS,
        new Uint8Array([1, 2, 3]),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "catalogo.xlsx",
      ),
    ).not.toThrow();

    const arrayBuffer = new ArrayBuffer(4);
    expect(() =>
      validateUpload(
        STORAGE_BUCKETS.EXCEL_ORIGINALS,
        arrayBuffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "catalogo.xlsx",
      ),
    ).not.toThrow();
  });
});

describe("normalizeStoragePath", () => {
  it("rechaza rutas con path traversal", () => {
    expect(() => normalizeStoragePath("../secret")).toThrow(StorageValidationError);
    expect(() => normalizeStoragePath("folder/../secret")).toThrow(
      StorageValidationError,
    );
  });

  it("normaliza backslashes y barras iniciales", () => {
    expect(normalizeStoragePath("\\catalogs\\cover.jpg")).toBe("catalogs/cover.jpg");
    expect(normalizeStoragePath("/catalogs/cover.jpg")).toBe("catalogs/cover.jpg");
  });

  it("rechaza rutas vacías", () => {
    expect(() => normalizeStoragePath("   ")).toThrow(StorageValidationError);
  });
});
