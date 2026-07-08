import { describe, expect, it } from "vitest";
import {
  detectColumnSemanticKind,
  detectSemanticFlags,
  isImageCodeColumnName,
  isImageCodeHeader,
} from "@/shared/import/header-semantics";

describe("header-semantics", () => {
  it("detecta código imagen con tildes y saltos de línea", () => {
    expect(detectSemanticFlags("CÓDIGO IMÁGEN").isImageCode).toBe(true);
    expect(detectSemanticFlags("CÓDIGO\nIMÁGEN").isImageCode).toBe(true);
    expect(detectColumnSemanticKind("CÓDIGO IMÁGEN")).toBe("imageCode");
    expect(isImageCodeHeader("CÓDIGO\nIMÁGEN")).toBe(true);
  });

  it("detecta variantes abreviadas de código imagen", () => {
    expect(isImageCodeColumnName("COD. IMG.")).toBe(true);
    expect(isImageCodeColumnName("COD. IMAGEN")).toBe(true);
    expect(isImageCodeColumnName("CODIGOIMAGEN")).toBe(true);
    expect(isImageCodeColumnName("CÓDIGOIMAGEN")).toBe(true);
    expect(isImageCodeHeader("CODIGO IMAGEN")).toBe(true);
  });

  it("no marca columnas de código o imagen aisladas como código imagen", () => {
    expect(isImageCodeColumnName("CÓDIGO PRINCIPAL")).toBe(false);
    expect(isImageCodeColumnName("IMAGEN")).toBe(false);
  });

  it("prioriza código imagen sobre código principal", () => {
    expect(detectColumnSemanticKind("CÓDIGO PRINCIPAL")).toBe("primaryCode");
  });
});
