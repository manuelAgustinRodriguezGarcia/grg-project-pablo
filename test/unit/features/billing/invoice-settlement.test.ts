import { describe, expect, it } from "vitest";
import {
  creditNoteCapCents,
  effectiveInvoicePaymentStatus,
  invoiceFiscalStatusFromNotes,
  invoiceOutstandingCents,
  invoiceOverpaymentCents,
  invoicePaymentStatusFromSettlement,
  persistedFiscalStatusAfterSettlement,
  planOverallocationRelease,
  splitGrossIvaCents,
} from "@/features/billing/utils/invoice-settlement";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";

describe("invoice-settlement", () => {
  it("el tope de NC ignora recibos y permite factura paga", () => {
    const total = pesosToCents(1000);
    const receipts = pesosToCents(1000);

    expect(creditNoteCapCents(total, 0, 0)).toBe(total);
    expect(
      invoiceOutstandingCents(total, 0, 0, receipts),
    ).toBe(0);
    expect(creditNoteCapCents(total, 0, 0)).toBe(total);
    expect(invoiceOverpaymentCents(receipts, creditNoteCapCents(total, 0, 0))).toBe(
      0,
    );
  });

  it("NC sobre factura paga deja el excedente como sobrepago, no como deuda negativa", () => {
    const total = pesosToCents(170_000);
    const allocated = pesosToCents(170_000);
    const credit = pesosToCents(85_000);
    const payable = creditNoteCapCents(total, credit, 0);

    expect(invoiceOutstandingCents(total, credit, 0, allocated)).toBe(0);
    expect(invoiceOverpaymentCents(allocated, payable)).toBe(credit);
  });

  it("libera imputaciones desde la más reciente", () => {
    const plan = planOverallocationRelease(
      [
        { id: "new", amountCents: pesosToCents(50_000) },
        { id: "old", amountCents: pesosToCents(120_000) },
      ],
      pesosToCents(85_000),
    );

    expect(plan.deleteIds).toEqual(["new"]);
    expect(plan.updates).toEqual([
      { id: "old", amountCents: pesosToCents(85_000) },
    ]);
  });

  it("NC parcial reduce el saldo; ND lo aumenta", () => {
    const total = pesosToCents(1000);
    const credit = pesosToCents(300);
    const debit = pesosToCents(200);

    expect(creditNoteCapCents(total, credit, 0)).toBe(pesosToCents(700));
    expect(invoiceOutstandingCents(total, credit, 0, 0)).toBe(pesosToCents(700));
    expect(invoiceOutstandingCents(total, 0, debit, 0)).toBe(pesosToCents(1200));
    expect(invoiceOutstandingCents(total, credit, debit, 0)).toBe(
      pesosToCents(900),
    );
  });

  it("anulación total por NC queda como anulada, no como impaga ni paga", () => {
    const total = pesosToCents(1000);
    const credit = pesosToCents(1000);
    const fiscal = invoiceFiscalStatusFromNotes(credit, 0, total);
    const outstanding = invoiceOutstandingCents(total, credit, 0, 0);

    expect(fiscal).toBe("ANULADA_NC");
    expect(outstanding).toBe(0);
    expect(
      invoicePaymentStatusFromSettlement(
        fiscal,
        outstanding,
        total,
        "CUENTA_CORRIENTE",
      ),
    ).toBe("ANULADA");
  });

  it("muestra Anulada aunque el estado guardado siga siendo Impaga", () => {
    expect(
      effectiveInvoicePaymentStatus(
        "CUENTA_CORRIENTE",
        "IMPAGA",
        "ANULADA_NC",
      ),
    ).toBe("ANULADA");
  });

  it("el contado sigue paga aunque el saldo teórico no esté imputado", () => {
    const total = pesosToCents(1089);

    expect(
      invoicePaymentStatusFromSettlement(
        "MODO_PRUEBA",
        total,
        total,
        "CONTADO_EFECTIVO",
      ),
    ).toBe("PAGA");
  });

  it("si hay ND y NC parcial, el fiscal es AJUSTADA_ND", () => {
    expect(
      invoiceFiscalStatusFromNotes(
        pesosToCents(300),
        pesosToCents(200),
        pesosToCents(1000),
      ),
    ).toBe("AJUSTADA_ND");
  });

  it("una factura autorizada con NC parcial sigue autorizada y baja el saldo", () => {
    const total = pesosToCents(1000);
    const credit = pesosToCents(300);
    const commercial = invoiceFiscalStatusFromNotes(credit, 0, total);

    expect(commercial).toBe("AJUSTADA_NC");
    expect(persistedFiscalStatusAfterSettlement("AUTORIZADA", commercial)).toBe(
      "AUTORIZADA",
    );
    expect(invoiceOutstandingCents(total, credit, 0, 0)).toBe(pesosToCents(700));
  });

  it("una factura autorizada con ND sigue autorizada y sube el saldo", () => {
    const total = pesosToCents(1000);
    const debit = pesosToCents(200);
    const commercial = invoiceFiscalStatusFromNotes(0, debit, total);

    expect(commercial).toBe("AJUSTADA_ND");
    expect(persistedFiscalStatusAfterSettlement("AUTORIZADA", commercial)).toBe(
      "AUTORIZADA",
    );
    expect(invoiceOutstandingCents(total, 0, debit, 0)).toBe(pesosToCents(1200));
  });

  it("una NC total sobre factura autorizada anula el saldo y conserva la autorización", () => {
    const total = pesosToCents(1000);
    const credit = pesosToCents(1000);
    const commercial = invoiceFiscalStatusFromNotes(credit, 0, total);
    const outstanding = invoiceOutstandingCents(total, credit, 0, 0);
    const paymentStatus = invoicePaymentStatusFromSettlement(
      commercial,
      outstanding,
      total,
      "CUENTA_CORRIENTE",
    );

    expect(commercial).toBe("ANULADA_NC");
    expect(persistedFiscalStatusAfterSettlement("AUTORIZADA", commercial)).toBe(
      "AUTORIZADA",
    );
    expect(outstanding).toBe(0);
    expect(paymentStatus).toBe("ANULADA");
    expect(
      effectiveInvoicePaymentStatus("CUENTA_CORRIENTE", paymentStatus, "AUTORIZADA"),
    ).toBe("ANULADA");
    expect(
      effectiveInvoicePaymentStatus("CONTADO_EFECTIVO", paymentStatus, "AUTORIZADA"),
    ).toBe("ANULADA");
  });

  it("en modo prueba el estado comercial de la nota sigue escribiéndose", () => {
    expect(
      persistedFiscalStatusAfterSettlement("MODO_PRUEBA", "AJUSTADA_NC"),
    ).toBe("AJUSTADA_NC");
    expect(
      persistedFiscalStatusAfterSettlement("MODO_PRUEBA", "ANULADA_NC"),
    ).toBe("ANULADA_NC");
  });

  it("desglosa IVA de un importe con IVA incluido", () => {
    const split = splitGrossIvaCents(pesosToCents(1210), 21);
    expect(split.netCents).toBe(pesosToCents(1000));
    expect(split.ivaCents).toBe(pesosToCents(210));
  });
});
