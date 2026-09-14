import { describe, expect, it } from "vitest";
import {
  buildBillingClientCode,
  buildBillingClientCodePrefix,
  normalizeBillingClientCode,
} from "@/server/services/billing-client-code";

describe("buildBillingClientCodePrefix", () => {
  it("usa la inicial de cada palabra", () => {
    expect(buildBillingClientCodePrefix("GOMERIA LA RUTA")).toBe("GLR");
    expect(buildBillingClientCodePrefix("DISTRIBUIDORA EL FARO")).toBe("DEF");
    expect(buildBillingClientCodePrefix("JUAN PEREZ")).toBe("JP");
  });

  it("usa las tres letras de una sigla inicial como GRG", () => {
    expect(buildBillingClientCodePrefix("GRG SOLUTIONS")).toBe("GRG");
  });

  it("ignora abreviaturas con punto y sufijos societarios", () => {
    expect(buildBillingClientCodePrefix("METALURGICA SAN MARTIN S.A.")).toBe(
      "MSM",
    );
    expect(buildBillingClientCodePrefix("GOMEZ SRL")).toBe("GOMEZ");
    expect(buildBillingClientCodePrefix("TRANSPORTES DEL SUR S.A.")).toBe("TDS");
  });

  it("usa CLI como prefijo de reserva para nombres sin letras útiles", () => {
    expect(buildBillingClientCodePrefix("+")).toBe("CLI");
    expect(buildBillingClientCodePrefix("")).toBe("CLI");
    expect(buildBillingClientCodePrefix("X")).toBe("CLI");
  });
});

describe("buildBillingClientCode", () => {
  it("combina prefijo y número de cinco dígitos", () => {
    expect(buildBillingClientCode("GRG SOLUTIONS", 1)).toBe("GRG-00001");
    expect(buildBillingClientCode("GOMERIA LA RUTA", 2)).toBe("GLR-00002");
    expect(buildBillingClientCode("SP Repuestos", 3)).toBe("SPR-00003");
  });

  it("no recorta números que superan el relleno", () => {
    expect(buildBillingClientCode("GOMEZ", 123456)).toBe("GOMEZ-123456");
  });
});

describe("normalizeBillingClientCode", () => {
  it("normaliza mayúsculas y rellena a cinco dígitos", () => {
    expect(normalizeBillingClientCode(" glr-2 ")).toBe("GLR-00002");
    expect(normalizeBillingClientCode("SPR-00003")).toBe("SPR-00003");
  });

  it("rechaza formatos inválidos", () => {
    expect(normalizeBillingClientCode("GLR")).toBeNull();
    expect(normalizeBillingClientCode("G-1")).toBeNull();
    expect(normalizeBillingClientCode("GLR 00002")).toBeNull();
  });
});
