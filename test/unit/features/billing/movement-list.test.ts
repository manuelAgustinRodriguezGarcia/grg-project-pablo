import { describe, expect, it } from "vitest";
import type { BillingNoteListItem } from "@/features/billing/types/billing-note.types";
import type { BillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";
import {
  buildBillingMovements,
  buildReceiptMovements,
  filterMovementList,
  movementKindEmptyCopy,
  movementKindLabel,
} from "@/features/billing/utils/movement-list";

function receipt(
  overrides: Partial<BillingReceiptListItem> = {},
): BillingReceiptListItem {
  return {
    id: "rec-1",
    receiptNumber: "REC-X-00000001",
    issuedAt: new Date("2026-08-20T12:00:00"),
    amount: 100,
    allocatedAmount: 100,
    remainingAmount: 0,
    allocationStatus: "IMPUTADO",
    paymentMethod: "TRANSFERENCIA",
    notes: null,
    createdByName: "Pablo",
    clientId: "client-1",
    clientName: "Taller Méndez",
    clientEmail: null,
    clientWhatsapp: null,
    allocations: [
      {
        invoiceId: "inv-1",
        invoiceNumber: "0007-PRUEBA-000000001",
        invoiceType: "B",
        amount: 100,
      },
    ],
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
    ...overrides,
  };
}

function note(
  overrides: Partial<BillingNoteListItem> = {},
): BillingNoteListItem {
  return {
    id: "note-1",
    kind: "CREDIT",
    noteNumber: "0007-PRUEBA-NC-000000001",
    issuedAt: new Date("2026-08-22T12:00:00"),
    invoiceId: "inv-1",
    invoiceNumber: "0007-PRUEBA-000000001",
    invoiceType: "B",
    amount: 50,
    netAmount: 41.32,
    ivaAmount: 8.68,
    reason: "Devolución parcial",
    clientId: "client-1",
    clientName: "Taller Méndez",
    clientCode: "C-0001",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    createdByName: "Pablo",
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
    ...overrides,
  };
}

describe("movementKindLabel", () => {
  it("nombra cada tipo de movimiento", () => {
    expect(movementKindLabel("RECEIPT")).toBe("Recibo");
    expect(movementKindLabel("CREDIT_NOTE")).toBe("Nota de crédito");
    expect(movementKindLabel("DEBIT_NOTE")).toBe("Nota de débito");
  });
});

describe("buildReceiptMovements", () => {
  it("lista recibos imputados y anticipos", () => {
    const anticipo = receipt({
      id: "rec-2",
      receiptNumber: "REC-X-00000002",
      issuedAt: new Date("2026-08-21T12:00:00"),
      allocatedAmount: 0,
      remainingAmount: 80,
      allocationStatus: "A_CUENTA",
      allocations: [],
    });

    const movements = buildReceiptMovements([receipt(), anticipo]);

    expect(movements).toHaveLength(2);
    expect(movements[0]?.number).toBe("REC-000002");
    expect(movements[0]?.invoiceId).toBeNull();
    expect(movements[0]?.invoiceNumbers).toBe("A cuenta");
    expect(movements[1]?.number).toBe("REC-000001");
    expect(movements[1]?.invoiceId).toBe("inv-1");
    expect(movements[1]?.clientName).toBe("Taller Méndez");
  });

  it("lista todas las facturas imputadas, no un conteo", () => {
    const movements = buildReceiptMovements([
      receipt({
        allocations: [
          {
            invoiceId: "inv-1",
            invoiceNumber: "0007-PRUEBA-000000001",
            invoiceType: "B",
            amount: 50,
          },
          {
            invoiceId: "inv-2",
            invoiceNumber: "0007-PRUEBA-000000002",
            invoiceType: "A",
            amount: 50,
          },
        ],
      }),
    ]);

    expect(movements[0]?.invoiceId).toBeNull();
    expect(movements[0]?.invoiceNumbers).toBe(
      "B 0007-PRUEBA-000000001 A 0007-PRUEBA-000000002",
    );
    expect(movements[0]?.invoices).toEqual([
      { id: "inv-1", label: "B 0007-PRUEBA-000000001" },
      { id: "inv-2", label: "A 0007-PRUEBA-000000002" },
    ]);
  });
});

describe("buildBillingMovements", () => {
  it("mezcla recibos y notas ordenados por fecha", () => {
    const movements = buildBillingMovements([receipt()], [note()]);

    expect(movements.map((movement) => movement.kind)).toEqual([
      "CREDIT_NOTE",
      "RECEIPT",
    ]);
    expect(movements[0]?.invoiceNumbers).toBe("B 0007-PRUEBA-000000001");
  });
});

describe("filterMovementList", () => {
  const movements = buildBillingMovements([receipt()], [note()]);

  it("filtra por tipo de movimiento", () => {
    expect(
      filterMovementList(movements, {
        query: "",
        kind: "RECEIPT",
        fromDate: "",
        toDate: "",
      }),
    ).toHaveLength(1);

    expect(
      filterMovementList(movements, {
        query: "",
        kind: "CREDIT_NOTE",
        fromDate: "",
        toDate: "",
      }),
    ).toHaveLength(1);

    expect(movementKindEmptyCopy("CREDIT_NOTE")).toContain("notas de crédito");
  });

  it("busca por número de recibo, cliente o factura", () => {
    expect(
      filterMovementList(movements, {
        query: "REC-000001",
        kind: "all",
        fromDate: "",
        toDate: "",
      }),
    ).toHaveLength(1);

    expect(
      filterMovementList(movements, {
        query: "méndez",
        kind: "all",
        fromDate: "",
        toDate: "",
      }),
    ).toHaveLength(2);

    expect(
      filterMovementList(movements, {
        query: "sin coincidencia",
        kind: "all",
        fromDate: "",
        toDate: "",
      }),
    ).toHaveLength(0);
  });

  it("filtra por fecha del movimiento, no de la factura", () => {
    expect(
      filterMovementList(movements, {
        query: "",
        kind: "all",
        fromDate: "2026-08-20",
        toDate: "2026-08-20",
      }),
    ).toHaveLength(1);

    expect(
      filterMovementList(movements, {
        query: "",
        kind: "all",
        fromDate: "2026-08-19",
        toDate: "2026-08-19",
      }),
    ).toHaveLength(0);
  });
});
