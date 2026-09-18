import { describe, expect, it } from "vitest";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { buildReceiptNumber, formatReceiptNumber } from "@/features/billing/utils/receipt-number";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import {
  allocateCreditFifo,
  cashNeededForInvoice,
  formatPesosInput,
  maskPesosInput,
  parsePesosInput,
  paymentStatusFromSaldoCents,
  receiptAllocationStatus,
  redistributeFifo,
  remainingAfterAllocation,
  remainingCents,
  clientCreditCents,
  clientAvailableCreditCents,
  splitApplyWithCredit,
  type ReceiptAllocationRow,
} from "@/features/billing/utils/receipt-allocation";
import { preselectInvoiceRows } from "@/features/billing/utils/receipt-prefill";

function row(
  id: string,
  outstandingPesos: number,
  issuedDay: number,
  selected = true,
): ReceiptAllocationRow {
  return {
    invoiceId: id,
    issuedAt: new Date(Date.UTC(2026, 0, issuedDay)),
    outstandingCents: pesosToCents(outstandingPesos),
    selected,
    applyCents: 0,
    applyLocked: false,
  };
}

describe("allocateCreditFifo", () => {
  it("aplica el saldo a favor a la factura más antigua primero", () => {
    const applied = allocateCreditFifo(
      [
        row("nueva", 800, 10),
        row("vieja", 500, 1),
        row("media", 400, 5),
      ],
      pesosToCents(700),
    );

    expect(applied.get("vieja")).toBe(pesosToCents(500));
    expect(applied.get("media")).toBe(pesosToCents(200));
    expect(applied.get("nueva")).toBe(0);
  });
});

describe("cashNeededForInvoice / remainingAfterAllocation", () => {
  it("completa el 100% considerando saldo a favor", () => {
    expect(cashNeededForInvoice(100_000, 30_000)).toBe(70_000);
    expect(remainingAfterAllocation(100_000, 30_000, 70_000)).toBe(0);
    expect(remainingAfterAllocation(100_000, 30_000, 20_000)).toBe(50_000);
  });
});

describe("paymentStatusFromSaldoCents", () => {
  it("marca paga, impaga y parcial", () => {
    expect(paymentStatusFromSaldoCents(0, 100_000_00)).toBe("PAGA");
    expect(paymentStatusFromSaldoCents(100_000_00, 100_000_00)).toBe("IMPAGA");
    expect(paymentStatusFromSaldoCents(50_000_00, 100_000_00)).toBe(
      "PARCIALMENTE_PAGA",
    );
  });
});

describe("receiptAllocationStatus", () => {
  it("deriva a cuenta, parcial e imputado", () => {
    expect(receiptAllocationStatus(150_000_00, 0)).toBe("A_CUENTA");
    expect(receiptAllocationStatus(150_000_00, 50_000_00)).toBe("PARCIAL");
    expect(receiptAllocationStatus(150_000_00, 150_000_00)).toBe("IMPUTADO");
  });
});

describe("redistributeFifo", () => {
  it("paga la factura más vieja primero y deja parcial la siguiente", () => {
    const result = redistributeFifo(
      [row("a", 1_000_000, 1), row("b", 1_000_000, 2)],
      pesosToCents(1_500_000),
    );

    expect(result[0]?.applyCents).toBe(pesosToCents(1_000_000));
    expect(result[1]?.applyCents).toBe(pesosToCents(500_000));
    expect(remainingCents(pesosToCents(1_500_000), pesosToCents(1_500_000))).toBe(
      0,
    );
  });

  it("sin facturas tildadas deja todo a cuenta", () => {
    const result = redistributeFifo(
      [row("a", 1_000_000, 1, false)],
      pesosToCents(200_000),
    );
    expect(result[0]?.applyCents).toBe(0);
    expect(
      remainingCents(pesosToCents(200_000), 0),
    ).toBe(pesosToCents(200_000));
  });

  it("conserva el monto de una fila editada a mano", () => {
    const locked: ReceiptAllocationRow[] = [
      { ...row("a", 1_000_000, 1), applyCents: pesosToCents(200_000), applyLocked: true },
      row("b", 1_000_000, 2),
    ];
    const result = redistributeFifo(locked, pesosToCents(1_500_000));
    expect(result[0]?.applyCents).toBe(pesosToCents(200_000));
    expect(result[1]?.applyCents).toBe(pesosToCents(1_000_000));
  });

  it("destildar pone aplica en cero", () => {
    const result = redistributeFifo(
      [{ ...row("a", 1_000_000, 1, false), applyCents: pesosToCents(500_000) }],
      pesosToCents(500_000),
    );
    expect(result[0]?.applyCents).toBe(0);
    expect(result[0]?.applyLocked).toBe(false);
  });
});

describe("preselectInvoiceRows", () => {
  it("tilda la factura del atajo", () => {
    const rows = [row("a", 1_000_000, 1, false), row("b", 1_000_000, 2, false)];
    const result = preselectInvoiceRows(rows, "b");
    expect(result[0]?.selected).toBe(false);
    expect(result[1]?.selected).toBe(true);
  });
});

describe("parsePesosInput y formatPesosInput", () => {
  it("entiende coma decimal y no trata el punto de toFixed como miles", () => {
    expect(parsePesosInput("50,00")).toBe(5000);
    expect(parsePesosInput("1.234,50")).toBe(123450);
    expect(formatPesosInput(5000)).toBe("50,00");
    expect(formatPesosInput(123450)).toBe("1.234,50");
    expect(parsePesosInput(formatPesosInput(123450))).toBe(123450);
  });
});

describe("maskPesosInput", () => {
  it("descarta letras y deja solo el número", () => {
    expect(maskPesosInput("abc")).toBe("");
    expect(maskPesosInput("1a2b3")).toBe("123");
  });

  it("separa miles con punto mientras se escribe", () => {
    expect(maskPesosInput("1")).toBe("1");
    expect(maskPesosInput("1234")).toBe("1.234");
    expect(maskPesosInput("1.2345")).toBe("12.345");
    expect(maskPesosInput("1234567")).toBe("1.234.567");
  });

  it("toma coma o punto tipeado como decimal", () => {
    expect(maskPesosInput("1,")).toBe("1,");
    expect(maskPesosInput("1.")).toBe("1,");
    expect(maskPesosInput("1,5")).toBe("1,5");
    expect(maskPesosInput("1.234.")).toBe("1.234,");
    expect(maskPesosInput("1.234,56")).toBe("1.234,56");
    expect(maskPesosInput("1.234,567")).toBe("1.234,56");
  });

  it("al borrar un miles no lo interpreta como decimal", () => {
    expect(maskPesosInput("1.23")).toBe("123");
  });
});

describe("clientCreditCents y splitApplyWithCredit", () => {
  it("suma el restante a favor del cliente", () => {
    expect(
      clientCreditCents(
        [
          { id: "r1", clientId: "c1", remainingAmount: 30 },
          { id: "r2", clientId: "c1", remainingAmount: 20 },
          { id: "r3", clientId: "c2", remainingAmount: 80 },
        ],
        "c1",
      ),
    ).toBe(pesosToCents(50));
  });

  it("incluye el excedente de NC sobre una factura paga todavía imputada", () => {
    expect(
      clientAvailableCreditCents(
        [{ id: "r1", clientId: "c1", remainingAmount: 0 }],
        [
          {
            clientId: "c1",
            paymentMethod: "CUENTA_CORRIENTE",
            totalVisualRounded: 170_000,
            creditNoteCap: 85_000,
            receipts: [{ allocatedToInvoice: 170_000 }],
          },
          {
            clientId: "c1",
            paymentMethod: "CUENTA_CORRIENTE",
            totalVisualRounded: 50_000,
            creditNoteCap: 50_000,
            receipts: [],
          },
        ],
        "c1",
      ),
    ).toBe(pesosToCents(85_000));
  });

  it("aplica el saldo a favor antes que el cobro nuevo", () => {
    const split = splitApplyWithCredit(
      [
        { invoiceId: "a", applyCents: pesosToCents(40) },
        { invoiceId: "b", applyCents: pesosToCents(30) },
      ],
      [{ receiptId: "r1", remainingCents: pesosToCents(50) }],
      pesosToCents(50),
    );

    expect(split.creditAllocations).toEqual([
      {
        receiptId: "r1",
        invoiceId: "a",
        amountCents: pesosToCents(40),
      },
      {
        receiptId: "r1",
        invoiceId: "b",
        amountCents: pesosToCents(10),
      },
    ]);
    expect(split.newReceiptAllocations).toEqual([
      { invoiceId: "b", amountCents: pesosToCents(20) },
    ]);
  });

  it("no usa más saldo a favor que el hueco entre imputado y cobro", () => {
    const split = splitApplyWithCredit(
      [{ invoiceId: "a", applyCents: pesosToCents(315_000) }],
      [{ receiptId: "r1", remainingCents: pesosToCents(500_000) }],
      pesosToCents(200_000),
    );

    expect(split.creditAllocations).toEqual([
      {
        receiptId: "r1",
        invoiceId: "a",
        amountCents: pesosToCents(200_000),
      },
    ]);
    expect(split.newReceiptAllocations).toEqual([
      { invoiceId: "a", amountCents: pesosToCents(115_000) },
    ]);
  });
});

describe("buildReceiptNumber", () => {
  it("usa el prefijo REC con 6 dígitos", () => {
    expect(buildReceiptNumber(1)).toBe("REC-000001");
    expect(buildReceiptNumber(12)).toBe("REC-000012");
  });
});

describe("formatReceiptNumber", () => {
  it("normaliza el formato viejo REC-X-########", () => {
    expect(formatReceiptNumber("REC-X-00000003")).toBe("REC-000003");
  });

  it("deja el formato nuevo igual", () => {
    expect(formatReceiptNumber("REC-000012")).toBe("REC-000012");
  });
});

describe("toWinAnsi", () => {
  it("reemplaza em dash y deja acentos latin-1", () => {
    expect(toWinAnsi("MODO PRUEBA — NO VÁLIDO")).toBe(
      "MODO PRUEBA - NO VÁLIDO",
    );
  });
});
