import { describe, expect, it } from "vitest";
import {
  ARCA_DOCUMENT_TYPE,
  ARCA_VOUCHER_TYPE,
  UNSUPPORTED_ARCA_VAT_CONDITION,
  UnsupportedArcaVatConditionError,
  resolveArcaFiscalProfile,
  voucherTypeForBillingNote,
} from "@/shared/fiscal/arca-fiscal-mapping";
import { determineInvoiceType } from "@/shared/utils/billing-invoice-rules";

describe("resolveArcaFiscalProfile", () => {
  it("mapea Responsable Inscripto con CUIT a Factura A", () => {
    const profile = resolveArcaFiscalProfile("CUIT", "RESPONSABLE_INSCRIPTO");

    expect(determineInvoiceType("CUIT", "RESPONSABLE_INSCRIPTO")).toBe("A");
    expect(profile.voucherClass).toBe("A");
    expect(profile.receptorVatConditionId).toBe(1);
    expect(profile.voucherType).toBe(ARCA_VOUCHER_TYPE.FACTURA_A);
    expect(profile.documentType).toBe(ARCA_DOCUMENT_TYPE.CUIT);
    expect(profile.documentNumber).toBeNull();
  });

  it("mapea Monotributista con CUIT a Factura A", () => {
    const profile = resolveArcaFiscalProfile("CUIT", "MONOTRIBUTISTA");

    expect(determineInvoiceType("CUIT", "MONOTRIBUTISTA")).toBe("A");
    expect(profile.voucherClass).toBe("A");
    expect(profile.receptorVatConditionId).toBe(6);
    expect(profile.documentType).toBe(80);
  });

  it("mapea Consumidor Final con CUIT a Factura B", () => {
    const profile = resolveArcaFiscalProfile("CUIT", "CONSUMIDOR_FINAL");

    expect(determineInvoiceType("CUIT", "CONSUMIDOR_FINAL")).toBe("B");
    expect(profile.receptorVatConditionId).toBe(5);
    expect(profile.voucherType).toBe(ARCA_VOUCHER_TYPE.FACTURA_B);
    expect(profile.documentType).toBe(80);
  });

  it("mapea Consumidor Final con DNI a DocTipo 96", () => {
    const profile = resolveArcaFiscalProfile("DNI", "CONSUMIDOR_FINAL");

    expect(determineInvoiceType("DNI", "CONSUMIDOR_FINAL")).toBe("B");
    expect(profile.receptorVatConditionId).toBe(5);
    expect(profile.documentType).toBe(ARCA_DOCUMENT_TYPE.DNI);
    expect(profile.documentNumber).toBeNull();
  });

  it("mapea Consumidor Final sin documento a DocTipo 99 y DocNro 0", () => {
    const profile = resolveArcaFiscalProfile("NINGUNO", "CONSUMIDOR_FINAL");

    expect(determineInvoiceType("NINGUNO", "CONSUMIDOR_FINAL")).toBe("B");
    expect(profile.receptorVatConditionId).toBe(5);
    expect(profile.documentType).toBe(99);
    expect(profile.documentNumber).toBe(0);
  });

  it("mapea Exento con CUIT a Factura B e IVA receptor 4", () => {
    const profile = resolveArcaFiscalProfile("CUIT", "EXENTO");

    expect(determineInvoiceType("CUIT", "EXENTO")).toBe("B");
    expect(profile.receptorVatConditionId).toBe(4);
    expect(profile.voucherType).toBe(6);
    expect(profile.documentType).toBe(80);
  });

  it("rechaza Responsable No Inscripto sin inventar un código ARCA", () => {
    expect(() => resolveArcaFiscalProfile("CUIT", "RESPONSABLE_NO_INSCRIPTO")).toThrow(
      UnsupportedArcaVatConditionError,
    );

    try {
      resolveArcaFiscalProfile("CUIT", "RESPONSABLE_NO_INSCRIPTO");
    } catch (error) {
      expect(error).toMatchObject({ code: UNSUPPORTED_ARCA_VAT_CONDITION });
    }
  });

  it("reserva los tipos de nota de débito y crédito", () => {
    expect(ARCA_VOUCHER_TYPE.NOTA_DEBITO_A).toBe(2);
    expect(ARCA_VOUCHER_TYPE.NOTA_CREDITO_A).toBe(3);
    expect(ARCA_VOUCHER_TYPE.NOTA_DEBITO_B).toBe(7);
    expect(ARCA_VOUCHER_TYPE.NOTA_CREDITO_B).toBe(8);
  });
});

describe("voucherTypeForBillingNote", () => {
  it("mapea débito A a 2", () => {
    expect(voucherTypeForBillingNote("DEBIT", "A")).toBe(2);
    expect(voucherTypeForBillingNote("DEBIT", "A")).toBe(ARCA_VOUCHER_TYPE.NOTA_DEBITO_A);
  });

  it("mapea crédito A a 3", () => {
    expect(voucherTypeForBillingNote("CREDIT", "A")).toBe(3);
    expect(voucherTypeForBillingNote("CREDIT", "A")).toBe(ARCA_VOUCHER_TYPE.NOTA_CREDITO_A);
  });

  it("mapea débito B a 7", () => {
    expect(voucherTypeForBillingNote("DEBIT", "B")).toBe(7);
    expect(voucherTypeForBillingNote("DEBIT", "B")).toBe(ARCA_VOUCHER_TYPE.NOTA_DEBITO_B);
  });

  it("mapea crédito B a 8", () => {
    expect(voucherTypeForBillingNote("CREDIT", "B")).toBe(8);
    expect(voucherTypeForBillingNote("CREDIT", "B")).toBe(ARCA_VOUCHER_TYPE.NOTA_CREDITO_B);
  });
});
