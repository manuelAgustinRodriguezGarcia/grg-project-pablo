import { describe, expect, it } from "vitest";
import { StorageValidationError } from "@/server/storage/errors";
import {
  getFileExtension,
  sanitizeFilename,
} from "@/server/storage/sanitize-filename";
import { buildImportExternalImagePath } from "@/server/image-processors/image-paths";

describe("sanitizeFilename", () => {
  it("extrae solo el basename de rutas con path traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\docs\\catalogo.xlsx")).toBe("catalogo.xlsx");
  });

  it("reemplaza caracteres especiales por guiones bajos", () => {
    expect(sanitizeFilename("archivo@#$%nombre.png")).toBe("archivo_nombre.png");
  });

  it("rechaza nombres vacíos o reservados", () => {
    expect(() => sanitizeFilename("")).toThrow(StorageValidationError);
    expect(() => sanitizeFilename(".")).toThrow(StorageValidationError);
    expect(() => sanitizeFilename("..")).toThrow(StorageValidationError);
  });

  it("pliega acentos a ASCII para keys de Storage", () => {
    expect(sanitizeFilename("Catálogo Azul.xlsx")).toBe("Catalogo Azul.xlsx");
    expect(sanitizeFilename("IMPULSOR-DIAMETROPIÑON.jpg")).toBe(
      "IMPULSOR-DIAMETROPINON.jpg",
    );
    expect(sanitizeFilename("piñón-áéíóúü.jpg")).toBe("pinon-aeiouu.jpg");
  });
});

describe("getFileExtension", () => {
  it("devuelve la extensión en minúsculas", () => {
    expect(getFileExtension("catalogo.XLSX")).toBe(".xlsx");
    expect(getFileExtension("foto.JPG")).toBe(".jpg");
  });

  it("devuelve cadena vacía sin extensión", () => {
    expect(getFileExtension("sin-extension")).toBe("");
    expect(getFileExtension(".hidden")).toBe("");
  });
});

describe("buildImportExternalImagePath", () => {
  it("usa nombre sanitizado en la key pero conserva extensión", () => {
    const path = buildImportExternalImagePath(
      "job1",
      "3b0bd5e3-b61d-40e7-89d2-529c32f71227",
      "IMPULSOR-DIAMETROPIÑON.jpg",
    );

    expect(path).toBe(
      "imports/job1/external/3b0bd5e3-b61d-40e7-89d2-529c32f71227-IMPULSOR-DIAMETROPINON.jpg",
    );
    expect(path).not.toMatch(/[^\x00-\x7F]/);
  });
});
