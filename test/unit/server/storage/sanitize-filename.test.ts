import { describe, expect, it } from "vitest";
import { StorageValidationError } from "@/server/storage/errors";
import {
  getFileExtension,
  sanitizeFilename,
} from "@/server/storage/sanitize-filename";

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

  it("conserva acentos y espacios en el nombre base", () => {
    expect(sanitizeFilename("Catálogo Azul.xlsx")).toBe("Catálogo Azul.xlsx");
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
