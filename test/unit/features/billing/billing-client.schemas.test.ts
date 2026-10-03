import { describe, expect, it } from "vitest";
import {
  createBillingClientSchema,
  updateBillingClientSchema,
} from "@/features/billing/schemas/billing-client.schemas";

const baseClient = {
  name: "Cliente",
  province: "Santa Fe",
};

describe("createBillingClientSchema", () => {
  it.each([
    ["CUIT", "RESPONSABLE_INSCRIPTO"],
    ["CUIT", "MONOTRIBUTISTA"],
    ["CUIT", "EXENTO"],
    ["CUIT", "CONSUMIDOR_FINAL"],
    ["DNI", "CONSUMIDOR_FINAL"],
    ["NINGUNO", "CONSUMIDOR_FINAL"],
  ] as const)("acepta %s + %s", (identificationType, ivaCondition) => {
    const parsed = createBillingClientSchema.safeParse({
      ...baseClient,
      identificationType,
      ivaCondition,
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    ["DNI", "MONOTRIBUTISTA", "Monotributista requiere CUIT."],
    ["NINGUNO", "MONOTRIBUTISTA", "Monotributista requiere CUIT."],
    ["DNI", "RESPONSABLE_INSCRIPTO", "Responsable Inscripto requiere CUIT."],
    ["NINGUNO", "RESPONSABLE_INSCRIPTO", "Responsable Inscripto requiere CUIT."],
    ["DNI", "EXENTO", "Exento requiere CUIT."],
    ["NINGUNO", "EXENTO", "Exento requiere CUIT."],
    [
      "CUIT",
      "RESPONSABLE_NO_INSCRIPTO",
      "Responsable No Inscripto no está disponible para clientes nuevos.",
    ],
  ] as const)(
    "rechaza %s + %s",
    (identificationType, ivaCondition, message) => {
      const parsed = createBillingClientSchema.safeParse({
        ...baseClient,
        identificationType,
        ivaCondition,
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(message);
      }
    },
  );
});

describe("updateBillingClientSchema", () => {
  it("deja pasar CUIT + Responsable No Inscripto para que el servicio resuelva el legado", () => {
    const parsed = updateBillingClientSchema.safeParse({
      ...baseClient,
      id: "cliente-1",
      identificationType: "CUIT",
      ivaCondition: "RESPONSABLE_NO_INSCRIPTO",
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza DNI + Responsable Inscripto", () => {
    const parsed = updateBillingClientSchema.safeParse({
      ...baseClient,
      id: "cliente-1",
      identificationType: "DNI",
      ivaCondition: "RESPONSABLE_INSCRIPTO",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        "Responsable Inscripto requiere CUIT.",
      );
    }
  });
});
