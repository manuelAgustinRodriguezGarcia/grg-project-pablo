import { beforeEach, describe, expect, it, vi } from "vitest";
import { billingStatisticsRepository } from "@/server/repositories/billing-statistics.repository";

const invoiceFind = vi.hoisted(() => vi.fn());
const invoiceFindFirst = vi.hoisted(() => vi.fn());
const noteFind = vi.hoisted(() => vi.fn());

vi.mock("@/server/database/prisma", () => ({
  prisma: {
    billingInvoice: { findMany: invoiceFind, findFirst: invoiceFindFirst },
    billingNote: { findMany: noteFind },
  },
}));

function decimal(value: string) {
  return { toFixed: () => value };
}

describe("repositorio de estadísticas", () => {
  beforeEach(() => {
    invoiceFind.mockResolvedValue([
      {
        id: "inv-1",
        issuedAt: new Date(2026, 2, 2),
        invoiceNumber: "0007-00000001",
        clientId: null,
        clientCode: "CLI-0001",
        clientName: "Taller Sur",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345671",
        total: decimal("121.40"),
        ivaAmount: decimal("21.07"),
        totalVisualRounded: decimal("121.00"),
        items: [
          {
            rubroId: null,
            rubroCode: "FRE-0001",
            rubroName: "Frenos",
            quantity: decimal("2.50"),
            lineTotal: decimal("121.40"),
            sortOrder: 0,
          },
        ],
      },
    ]);
    noteFind.mockResolvedValue([
      {
        id: "note-1",
        kind: "CREDIT",
        issuedAt: new Date(2026, 2, 3),
        noteNumber: "0007-00000002",
        invoiceId: "inv-1",
        invoice: { invoiceNumber: "0007-00000001" },
        clientId: "client-1",
        clientCode: "CLI-0001",
        clientName: "Taller Sur",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345671",
        netAmount: decimal("10.00"),
        ivaAmount: decimal("2.10"),
        amount: decimal("12.10"),
      },
    ]);
  });

  it("filtra como el Libro de IVA y no carga recibos ni fichas vivas", async () => {
    const range = { from: new Date(2026, 2, 1), to: new Date(2026, 3, 1) };
    const source = await billingStatisticsRepository.findSource(range, "MODO_PRUEBA");

    const invoiceQuery = invoiceFind.mock.calls[0]?.[0];
    const noteQuery = noteFind.mock.calls[0]?.[0];
    expect(invoiceQuery.where).toEqual({
      environment: "MODO_PRUEBA",
      issuedAt: { gte: range.from, lt: range.to },
    });
    expect(invoiceQuery.where).not.toHaveProperty("fiscalStatus");
    expect(invoiceQuery.select).not.toHaveProperty("clientEmail");
    expect(invoiceQuery.select).not.toHaveProperty("allocations");
    expect(invoiceQuery.select).not.toHaveProperty("billingNotes");
    expect(noteQuery.where.fiscalStatus).toBe("INTERNA");
    expect(noteQuery.select).not.toHaveProperty("reason");
    expect(source.invoices[0]?.total).toBe("121.40");
    expect(source.invoices[0]?.items[0]?.quantity).toBe("2.50");
    expect(source.notes[0]?.kind).toBe("CREDIT");
    expect(source.notes[0]?.invoiceId).toBe("inv-1");
    expect(source.notes[0]?.invoiceNumber).toBe("0007-00000001");
    expect(noteQuery.select.invoice.select.invoiceNumber).toBe(true);

    await billingStatisticsRepository.findSource(range, "PRODUCCION");
    await billingStatisticsRepository.findSource(range, "HOMOLOGACION");
    expect(noteFind.mock.calls[1]?.[0].where.fiscalStatus).toBe("AUTORIZADA");
    expect(noteFind.mock.calls[2]?.[0].where.fiscalStatus).toBe("AUTORIZADA");
    expect(invoiceFind).toHaveBeenCalledTimes(3);
    expect(noteFind).toHaveBeenCalledTimes(3);
  });

  it("devuelve solo los años del rango que tienen facturas", async () => {
    invoiceFindFirst.mockImplementation(async (query: {
      where: { environment: string; issuedAt: { gte: Date } };
      select: { id: boolean };
    }) => {
      expect(query.where.environment).toBe("PRODUCCION");
      expect(query.select).toEqual({ id: true });
      return query.where.issuedAt.gte.getFullYear() === 2026 ? { id: "inv-2026" } : null;
    });

    await expect(
      billingStatisticsRepository.findInvoicedYears("PRODUCCION", 2026, 2027),
    ).resolves.toEqual([2026]);
    expect(invoiceFindFirst).toHaveBeenCalledTimes(2);

    invoiceFindFirst.mockClear();
    await expect(
      billingStatisticsRepository.findInvoicedYears("PRODUCCION", 2027, 2026),
    ).resolves.toEqual([]);
    expect(invoiceFindFirst).not.toHaveBeenCalled();
  });
});
