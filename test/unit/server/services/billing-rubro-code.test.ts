import { describe, expect, it } from "vitest";
import {
  buildBillingRubroCode,
  buildBillingRubroCodePrefix,
} from "@/server/services/billing-rubro-code";

describe("buildBillingRubroCodePrefix", () => {
  it("usa la primera palabra del nombre en mayúsculas", () => {
    expect(buildBillingRubroCodePrefix("Embragues")).toBe("EMBRA");
    expect(buildBillingRubroCodePrefix("Repuestos varios")).toBe("REPUE");
  });

  it("elimina diacríticos y caracteres no alfanuméricos", () => {
    expect(buildBillingRubroCodePrefix("Neumáticos")).toBe("NEUMA");
    expect(buildBillingRubroCodePrefix("Aceites & lubricantes")).toBe("ACEIT");
  });

  it("usa el prefijo RUB cuando el nombre no aporta letras suficientes", () => {
    expect(buildBillingRubroCodePrefix("A")).toBe("RUB");
    expect(buildBillingRubroCodePrefix("-")).toBe("RUB");
  });
});

describe("buildBillingRubroCode", () => {
  it("combina prefijo y número con relleno de cuatro dígitos", () => {
    expect(buildBillingRubroCode("Embragues", 1)).toBe("EMBRA-0001");
    expect(buildBillingRubroCode("Filtros", 42)).toBe("FILTR-0042");
    expect(buildBillingRubroCode("Frenos", 12345)).toBe("FRENO-12345");
  });
});
