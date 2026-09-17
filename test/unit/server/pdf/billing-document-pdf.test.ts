import { describe, expect, it } from "vitest";
import { DEFAULT_PDF_ISSUER } from "@/server/pdf/invoice-pdf-issuer";
import { buildInvoicePdf } from "@/server/pdf/build-invoice-pdf";
import { buildNotePdf } from "@/server/pdf/build-note-pdf";
import { buildReceiptPdf } from "@/server/pdf/build-receipt-pdf";
import { loadRothamelLogoPng } from "@/server/pdf/load-rothamel-logo";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";

const issuer: InvoicePdfIssuer = {
  ...DEFAULT_PDF_ISSUER,
  cuit: "20-12345678-9",
  address: "Acceso Este",
  city: "Pampa del Infierno",
  province: "Chaco",
  ivaCondition: "IVA Responsable Inscripto",
};

describe("PDFs de comprobantes", () => {
  it("genera factura, nota y recibo sin error", async () => {
    const [invoice, creditNote, debitNote, receipt] = await Promise.all([
      buildInvoicePdf({
        invoiceType: "A",
        invoiceNumber: "0007-PRUEBA-000000001",
        pointOfSale: "0007",
        issuedAt: new Date("2026-09-02T12:00:00.000Z"),
        environment: "MODO_PRUEBA",
        clientName: "Cliente SA",
        clientCode: "0001",
        clientAddress: "Calle 1",
        clientCity: "Resistencia",
        clientProvince: "Chaco",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345678",
        clientIvaCondition: "RESPONSABLE_INSCRIPTO",
        items: [
          {
            rubroCode: "001",
            description: "Repuesto",
            quantity: 1,
            unitPrice: 1210,
            lineTotal: 1210,
          },
        ],
        subtotal: 1000,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 21,
        ivaAmount: 210,
        total: 1210,
        totalVisualRounded: 1210,
        paymentMethod: "CONTADO",
        notes: null,
        issuer,
        logoPng: null,
      }),
      buildNotePdf({
        kind: "CREDIT",
        noteNumber: "0007-PRUEBA-NC-000000001",
        invoiceType: "A",
        invoiceNumber: "0007-PRUEBA-000000001",
        issuedAt: new Date("2026-09-02T12:00:00.000Z"),
        amount: 1210,
        netAmount: 1000,
        ivaAmount: 210,
        ivaPercent: 21,
        reason: "Anulacion parcial",
        clientName: "Cliente SA",
        clientCode: "0001",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345678",
        createdByName: "Admin",
        issuer,
        logoPng: null,
        environment: "MODO_PRUEBA",
      }),
      buildNotePdf({
        kind: "DEBIT",
        noteNumber: "0007-PRUEBA-ND-000000001",
        invoiceType: "B",
        invoiceNumber: "0007-PRUEBA-000000002",
        issuedAt: new Date("2026-09-02T12:00:00.000Z"),
        amount: 500,
        netAmount: 413.22,
        ivaAmount: 86.78,
        ivaPercent: 21,
        reason: "Ajuste",
        clientName: "Cliente SA",
        clientCode: "0001",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345678",
        createdByName: "Admin",
        issuer,
        logoPng: null,
        environment: "MODO_PRUEBA",
      }),
      buildReceiptPdf({
        receiptNumber: "0007-PRUEBA-RX-000000001",
        issuedAt: new Date("2026-09-02T12:00:00.000Z"),
        amount: 1210,
        paymentMethod: "EFECTIVO",
        notes: null,
        createdByName: "Admin",
        clientName: "Cliente SA",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345678",
        allocations: [],
        remainingAmount: 0,
        issuer,
        logoPng: null,
        environment: "MODO_PRUEBA",
      }),
    ]);

    expect(invoice.byteLength).toBeGreaterThan(500);
    expect(creditNote.byteLength).toBeGreaterThan(500);
    expect(debitNote.byteLength).toBeGreaterThan(500);
    expect(receipt.byteLength).toBeGreaterThan(500);
  });

  it("incrusta el logo Rothamel en factura, nota y recibo", async () => {
    const logoPng = await loadRothamelLogoPng();
    expect(logoPng).not.toBeNull();

    const [invoice, note, receipt] = await Promise.all([
      buildInvoicePdf({
        invoiceType: "B",
        invoiceNumber: "0007-PRUEBA-000000001",
        pointOfSale: "0007",
        issuedAt: new Date("2026-09-01T12:00:00.000Z"),
        environment: "MODO_PRUEBA",
        clientName: "Cliente SA",
        clientCode: "0001",
        clientAddress: "Calle 1",
        clientCity: "Resistencia",
        clientProvince: "Chaco",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345678",
        clientIvaCondition: "RESPONSABLE_INSCRIPTO",
        items: [
          {
            rubroCode: "001",
            description: "Repuesto",
            quantity: 1,
            unitPrice: 1210,
            lineTotal: 1210,
          },
        ],
        subtotal: 1000,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 21,
        ivaAmount: 210,
        total: 1210,
        totalVisualRounded: 1210,
        paymentMethod: "CONTADO",
        notes: null,
        issuer,
        logoPng,
      }),
      buildNotePdf({
        kind: "CREDIT",
        noteNumber: "0007-PRUEBA-NC-000000001",
        invoiceType: "A",
        invoiceNumber: "0007-PRUEBA-000000001",
        issuedAt: new Date("2026-09-01T12:00:00.000Z"),
        amount: 1210,
        netAmount: 1000,
        ivaAmount: 210,
        ivaPercent: 21,
        reason: "Anulacion parcial",
        clientName: "Cliente SA",
        clientCode: "0001",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345678",
        createdByName: "Admin",
        issuer,
        logoPng,
        environment: "MODO_PRUEBA",
      }),
      buildReceiptPdf({
        receiptNumber: "REC-000012",
        issuedAt: new Date("2026-09-01T12:00:00.000Z"),
        amount: 1210,
        paymentMethod: "EFECTIVO",
        notes: null,
        createdByName: "Admin",
        clientName: "Cliente SA",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30712345678",
        allocations: [],
        remainingAmount: 0,
        issuer,
        logoPng,
        environment: "MODO_PRUEBA",
      }),
    ]);

    expect(invoice.byteLength).toBeGreaterThan(8_000);
    expect(note.byteLength).toBeGreaterThan(8_000);
    expect(receipt.byteLength).toBeGreaterThan(8_000);
  });
});
