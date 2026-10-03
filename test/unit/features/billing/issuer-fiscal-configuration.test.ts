import { describe, expect, it } from "vitest";
import { updateIssuerFiscalSettingsSchema } from "@/features/billing/schemas/billing-fiscal-settings.schemas";
import {
  formatActivitiesStartedAt,
  getIssuerFiscalConfigurationStatus,
  parseActivitiesStartedAt,
} from "@/features/billing/utils/issuer-fiscal-configuration";

const completeIssuer = {
  issuerName: "Rothamel Repuestos",
  issuerCuit: "30-71234567-1",
  issuerAddress: "Ruta 89 km 4",
  issuerCity: "Pampa del Infierno",
  issuerProvince: "Chaco",
  issuerIvaCondition: "Responsable Inscripto",
  issuerGrossIncome: "IIBB-123456",
  issuerActivitiesStartedAt: "2004-03-15",
};

describe("datos fiscales del emisor", () => {
  it("acepta un CUIT válido escrito con guiones", () => {
    const parsed = updateIssuerFiscalSettingsSchema.parse(completeIssuer);

    expect(parsed.issuerCuit).toBe("30-71234567-1");
  });

  it("rechaza un CUIT inválido", () => {
    const parsed = updateIssuerFiscalSettingsSchema.safeParse({
      ...completeIssuer,
      issuerCuit: "30712345670",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        "El CUIT del emisor no es válido.",
      );
    }
  });

  it.each([
    ["issuerName", "", "La razón social es obligatoria."],
    ["issuerAddress", "   ", "El domicilio comercial es obligatorio."],
    ["issuerCity", "", "La localidad es obligatoria."],
    ["issuerProvince", "", "La provincia es obligatoria."],
    ["issuerIvaCondition", "", "La condición frente al IVA es obligatoria."],
    ["issuerGrossIncome", "", "Los ingresos brutos son obligatorios."],
    ["issuerActivitiesStartedAt", "31/04/2004", "La fecha de inicio de actividades no es válida."],
  ] as const)("exige %s", (field, value, message) => {
    const parsed = updateIssuerFiscalSettingsSchema.safeParse({
      ...completeIssuer,
      [field]: value,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(message);
    }
  });
});

describe("inicio de actividades", () => {
  it("lee 04/05/2007 como 4 de mayo y lo muestra igual", () => {
    expect(parseActivitiesStartedAt("04/05/2007")).toBe("2007-05-04");
    expect(formatActivitiesStartedAt("2007-05-04")).toBe("04/05/2007");
    expect(formatActivitiesStartedAt("04/05/2007")).toBe("04/05/2007");
  });

  it("no invierte una fecha ya guardada como año-mes-día", () => {
    expect(parseActivitiesStartedAt("2007-04-05")).toBe("2007-04-05");
    expect(formatActivitiesStartedAt("2007-04-05")).toBe("05/04/2007");
  });
});

describe("getIssuerFiscalConfigurationStatus", () => {
  it("marca la configuración completa cuando están todos los campos", () => {
    expect(
      getIssuerFiscalConfigurationStatus({
        ...completeIssuer,
        issuerCuit: "30712345671",
        pointOfSale: "0007",
      }),
    ).toEqual({ complete: true, missingFields: [] });
  });

  it("enumera los campos que faltan sin bloquear el resto de la configuración", () => {
    expect(
      getIssuerFiscalConfigurationStatus({
        issuerName: null,
        issuerCuit: "30712345671",
        issuerAddress: "",
        issuerCity: null,
        issuerProvince: null,
        issuerIvaCondition: null,
        issuerGrossIncome: null,
        issuerActivitiesStartedAt: null,
        pointOfSale: "0007",
      }),
    ).toEqual({
      complete: false,
      missingFields: [
        "issuerName",
        "issuerAddress",
        "issuerCity",
        "issuerProvince",
        "issuerIvaCondition",
        "issuerGrossIncome",
        "issuerActivitiesStartedAt",
      ],
    });
  });
});
