import { describe, expect, it } from "vitest";
import {
  clientFiscalPairError,
  selectableIvaConditions,
} from "@/shared/fiscal/billing-client-fiscal-rules";

describe("clientFiscalPairError", () => {
  it.each([
    ["CUIT", "RESPONSABLE_INSCRIPTO"],
    ["CUIT", "MONOTRIBUTISTA"],
    ["CUIT", "EXENTO"],
    ["CUIT", "CONSUMIDOR_FINAL"],
    ["DNI", "CONSUMIDOR_FINAL"],
    ["NINGUNO", "CONSUMIDOR_FINAL"],
  ] as const)("acepta %s + %s", (identificationType, ivaCondition) => {
    expect(
      clientFiscalPairError({ identificationType, ivaCondition }),
    ).toBeNull();
  });

  it.each([
    ["DNI", "MONOTRIBUTISTA", "Monotributista requiere CUIT."],
    ["NINGUNO", "MONOTRIBUTISTA", "Monotributista requiere CUIT."],
    ["DNI", "RESPONSABLE_INSCRIPTO", "Responsable Inscripto requiere CUIT."],
    ["NINGUNO", "RESPONSABLE_INSCRIPTO", "Responsable Inscripto requiere CUIT."],
    ["DNI", "EXENTO", "Exento requiere CUIT."],
    ["NINGUNO", "EXENTO", "Exento requiere CUIT."],
  ] as const)(
    "rechaza %s + %s",
    (identificationType, ivaCondition, message) => {
      expect(
        clientFiscalPairError({ identificationType, ivaCondition }),
      ).toBe(message);
    },
  );

  it("rechaza Responsable No Inscripto en un alta", () => {
    expect(
      clientFiscalPairError({
        identificationType: "CUIT",
        ivaCondition: "RESPONSABLE_NO_INSCRIPTO",
      }),
    ).toBe("Responsable No Inscripto no está disponible para clientes nuevos.");
  });

  it("permite conservar Responsable No Inscripto con CUIT en un cliente que ya lo tiene", () => {
    expect(
      clientFiscalPairError({
        identificationType: "CUIT",
        ivaCondition: "RESPONSABLE_NO_INSCRIPTO",
        existingIvaCondition: "RESPONSABLE_NO_INSCRIPTO",
      }),
    ).toBeNull();
  });

  it("no permite volver a Responsable No Inscripto después de cambiar la condición", () => {
    expect(
      clientFiscalPairError({
        identificationType: "CUIT",
        ivaCondition: "RESPONSABLE_NO_INSCRIPTO",
        existingIvaCondition: "RESPONSABLE_INSCRIPTO",
      }),
    ).toBe("Responsable No Inscripto no está disponible para clientes nuevos.");
  });
});

describe("selectableIvaConditions", () => {
  it("con DNI o sin documento solo ofrece Consumidor Final", () => {
    expect(
      selectableIvaConditions({
        identificationType: "DNI",
        currentIvaCondition: "CONSUMIDOR_FINAL",
      }),
    ).toEqual(["CONSUMIDOR_FINAL"]);
    expect(
      selectableIvaConditions({
        identificationType: "NINGUNO",
        currentIvaCondition: "CONSUMIDOR_FINAL",
      }),
    ).toEqual(["CONSUMIDOR_FINAL"]);
  });

  it("con CUIT ofrece las condiciones soportadas y oculta Responsable No Inscripto", () => {
    expect(
      selectableIvaConditions({
        identificationType: "CUIT",
        currentIvaCondition: "RESPONSABLE_INSCRIPTO",
      }),
    ).toEqual([
      "RESPONSABLE_INSCRIPTO",
      "MONOTRIBUTISTA",
      "CONSUMIDOR_FINAL",
      "EXENTO",
    ]);
  });

  it("muestra Responsable No Inscripto solo mientras el cliente legacy sigue en esa condición", () => {
    expect(
      selectableIvaConditions({
        identificationType: "CUIT",
        currentIvaCondition: "RESPONSABLE_NO_INSCRIPTO",
        initialIvaCondition: "RESPONSABLE_NO_INSCRIPTO",
      }),
    ).toContain("RESPONSABLE_NO_INSCRIPTO");

    expect(
      selectableIvaConditions({
        identificationType: "CUIT",
        currentIvaCondition: "RESPONSABLE_INSCRIPTO",
        initialIvaCondition: "RESPONSABLE_NO_INSCRIPTO",
      }),
    ).not.toContain("RESPONSABLE_NO_INSCRIPTO");
  });
});
