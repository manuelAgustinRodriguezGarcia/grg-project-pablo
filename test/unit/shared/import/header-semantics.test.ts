import { describe, expect, it } from "vitest";
import {
  detectColumnSemanticKind,
  detectSemanticFlags,
  isImageCodeHeader,
} from "@/shared/import/header-semantics";

describe("header-semantics", () => {
  it("detecta código imagen con tildes y saltos de línea", () => {
    expect(detectSemanticFlags("CÓDIGO IMÁGEN").isImageCode).toBe(true);
    expect(detectSemanticFlags("CÓDIGO\nIMÁGEN").isImageCode).toBe(true);
    expect(detectColumnSemanticKind("CÓDIGO IMÁGEN")).toBe("imageCode");
    expect(isImageCodeHeader("CÓDIGO\nIMÁGEN")).toBe(true);
  });

  it("prioriza código imagen sobre código principal", () => {
    expect(detectColumnSemanticKind("CÓDIGO PRINCIPAL")).toBe("primaryCode");
  });
});
