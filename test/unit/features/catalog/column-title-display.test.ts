import { describe, expect, it } from "vitest";
import {
  formatColumnTitleForDisplay,
  formatProductFormColumnTitle,
} from "@/features/catalog/utils/column-title-display";

describe("formatColumnTitleForDisplay", () => {
  it("convierte saltos de línea en espacios", () => {
    expect(formatColumnTitleForDisplay("USO\nPRINCIPAL")).toBe("USO PRINCIPAL");
    expect(formatColumnTitleForDisplay("USO\rPRINCIPAL")).toBe("USO PRINCIPAL");
    expect(formatColumnTitleForDisplay("USO\r\nPRINCIPAL")).toBe("USO PRINCIPAL");
  });

  it("colapsa espacios múltiples", () => {
    expect(formatColumnTitleForDisplay("CLASE   DE   COMPRESOR")).toBe("CLASE DE COMPRESOR");
  });

  it("normaliza espacios no separables", () => {
    expect(formatColumnTitleForDisplay("USO\u00a0PRINCIPAL")).toBe("USO PRINCIPAL");
  });
});

describe("formatProductFormColumnTitle", () => {
  it("agrega el prefijo de columna al título", () => {
    expect(formatProductFormColumnTitle(1, "Número de orden")).toBe(
      "COL 1. - Número de orden",
    );
    expect(formatProductFormColumnTitle(4, "USO\nPRINCIPAL")).toBe("COL 4. - USO PRINCIPAL");
  });
});
