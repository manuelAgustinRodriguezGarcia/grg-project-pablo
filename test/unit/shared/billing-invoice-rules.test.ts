import { describe, expect, it } from "vitest";
import {
  buildTestInvoiceNumber,
  GENERIC_BILLING_CLIENT_NAME,
  determineInvoiceType,
  isCanonicalGenericBillingClient,
  isGenericBillingClient,
  paymentStatusForMethod,
  canInvoiceUseOnAccountPayment,
} from "@/shared/utils/billing-invoice-rules";

describe("determineInvoiceType", () => {
  it("aplica la matriz de determinación del PRD §11.2", () => {
    expect(determineInvoiceType("NINGUNO", "CONSUMIDOR_FINAL")).toBe("B");
    expect(determineInvoiceType("DNI", "CONSUMIDOR_FINAL")).toBe("B");
    expect(determineInvoiceType("CUIT", "EXENTO")).toBe("B");
    expect(determineInvoiceType("CUIT", "CONSUMIDOR_FINAL")).toBe("B");
    expect(determineInvoiceType("CUIT", "MONOTRIBUTISTA")).toBe("B");
    expect(determineInvoiceType("CUIT", "RESPONSABLE_INSCRIPTO")).toBe("A");
    expect(determineInvoiceType("CUIT", "RESPONSABLE_NO_INSCRIPTO")).toBe("B");
  });

  it("solo genera Factura A con CUIT + Responsable Inscripto", () => {
    expect(determineInvoiceType("DNI", "RESPONSABLE_INSCRIPTO")).toBe("B");
    expect(determineInvoiceType("NINGUNO", "RESPONSABLE_INSCRIPTO")).toBe("B");
  });
});

describe("isGenericBillingClient", () => {
  it("detecta cliente sin documento, email ni teléfono", () => {
    expect(
      isGenericBillingClient({
        identificationType: "NINGUNO",
        email: null,
        whatsapp: null,
      }),
    ).toBe(true);
  });

  it("no es genérico si tiene algún dato de contacto o documento", () => {
    expect(
      isGenericBillingClient({
        identificationType: "NINGUNO",
        email: "cliente@mail.com",
        whatsapp: null,
      }),
    ).toBe(false);
    expect(
      isGenericBillingClient({
        identificationType: "NINGUNO",
        email: null,
        whatsapp: "+5493624000000",
      }),
    ).toBe(false);
    expect(
      isGenericBillingClient({
        identificationType: "DNI",
        email: null,
        whatsapp: null,
      }),
    ).toBe(false);
    expect(
      isGenericBillingClient({
        identificationType: "CUIT",
        email: null,
        whatsapp: null,
      }),
    ).toBe(false);
  });
});

describe("isCanonicalGenericBillingClient", () => {
  it("solo coincide el cliente sin identificación con el nombre canónico", () => {
    expect(
      isCanonicalGenericBillingClient({
        name: GENERIC_BILLING_CLIENT_NAME,
        identificationType: "NINGUNO",
        email: null,
        whatsapp: null,
      }),
    ).toBe(true);
    expect(
      isCanonicalGenericBillingClient({
        name: "JUAN PEREZ",
        identificationType: "NINGUNO",
        email: null,
        whatsapp: null,
      }),
    ).toBe(false);
  });
});

describe("buildTestInvoiceNumber", () => {
  it("genera la numeración simulada del PRD §24.4", () => {
    expect(buildTestInvoiceNumber("0007", 1)).toBe("0007-PRUEBA-000000001");
    expect(buildTestInvoiceNumber("0007", 123)).toBe("0007-PRUEBA-000000123");
    expect(buildTestInvoiceNumber("0007", 999999999)).toBe(
      "0007-PRUEBA-999999999",
    );
  });
});

describe("paymentStatusForMethod", () => {
  it("marca impaga solo la cuenta corriente", () => {
    expect(paymentStatusForMethod("CUENTA_CORRIENTE")).toBe("IMPAGA");
    expect(paymentStatusForMethod("CONTADO")).toBe("PAGA");
    expect(paymentStatusForMethod("TARJETA")).toBe("PAGA");
    expect(paymentStatusForMethod("TRANSFERENCIA")).toBe("PAGA");
    expect(paymentStatusForMethod("OTROS")).toBe("PAGA");
    expect(paymentStatusForMethod("CONTADO_EFECTIVO")).toBe("PAGA");
  });
});

describe("canInvoiceUseOnAccountPayment", () => {
  it("no permite cuenta corriente sin documento", () => {
    expect(canInvoiceUseOnAccountPayment("NINGUNO")).toBe(false);
    expect(canInvoiceUseOnAccountPayment("DNI")).toBe(true);
    expect(canInvoiceUseOnAccountPayment("CUIT")).toBe(true);
  });
});
