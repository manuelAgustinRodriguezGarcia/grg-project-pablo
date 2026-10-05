/**
 * Verificación read-only de la ND A ya autorizada en homologación.
 * Genera el PDF fiscal y el Libro IVA fuera del repositorio.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-verify-debit-note-artifacts.ts
 *
 * Los imports de base y PDF entran después del guard de red para abortar
 * antes de cualquier fetch. No hay una dependencia circular.
 */
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import ExcelJS from "exceljs";
import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteKind,
} from "@/generated/prisma/client";
import { libroIvaMonthRange } from "@/features/billing/utils/libro-iva";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { ARCA_DOCUMENT_TYPE } from "@/shared/fiscal/arca-fiscal-mapping";
import {
  ArtifactAbort,
  HOMO_DEBIT_ARTIFACT_INVOICE_ID,
  HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER,
  HOMO_DEBIT_ARTIFACT_INVOICE_TOTAL_CENTS,
  HOMO_DEBIT_ARTIFACT_MONTH,
  HOMO_DEBIT_ARTIFACT_NOTE_AMOUNT_CENTS,
  HOMO_DEBIT_ARTIFACT_NOTE_ID,
  HOMO_DEBIT_ARTIFACT_NOTE_IVA_CENTS,
  HOMO_DEBIT_ARTIFACT_NOTE_NET_CENTS,
  HOMO_DEBIT_ARTIFACT_NOTE_NUMBER,
  HOMO_DEBIT_ARTIFACT_YEAR,
  assertCreditAndDebitCoexist,
  assertDebitArtifactArgs,
  assertDebitNoteBalance,
  assertDebitNotePdfText,
  assertProductionIsolationById,
  assessDebitHomologationLibro,
  formatCaeExpirationUtc,
  formatDebitQrVerification,
  installFetchGuard,
  pdfText,
  productionFlagLabel,
} from "./arca-homo-verify-debit-note-artifacts-plan";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

const FISCAL_SETTINGS_ID = "fiscal-settings";

function requireCae(value: string | null, label: string): string {
  const cae = value?.trim() ?? "";

  if (!cae) {
    throw new ArtifactAbort(`${label} no tiene CAE.`);
  }

  return cae;
}

function receptorExpectation(type: "CUIT" | "DNI" | "NINGUNO", number: string | null): {
  digits: string | null;
  docType: number | null;
} {
  switch (type) {
    case "NINGUNO":
      return { digits: null, docType: null };
    case "CUIT":
      return {
        digits: (number ?? "").replace(/\D/g, ""),
        docType: ARCA_DOCUMENT_TYPE.CUIT,
      };
    case "DNI":
      return {
        digits: (number ?? "").replace(/\D/g, ""),
        docType: ARCA_DOCUMENT_TYPE.DNI,
      };
    default: {
      const unexpected: never = type;
      return unexpected;
    }
  }
}

function invoiceLibroSource(row: {
  issuedAt: Date;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  invoiceNumber: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  subtotal: { toNumber: () => number };
  discountAmount: { toNumber: () => number };
  ivaPercent: { toNumber: () => number };
  ivaAmount: { toNumber: () => number };
  total: { toNumber: () => number };
  totalVisualRounded: { toNumber: () => number };
}) {
  return {
    issuedAt: row.issuedAt,
    invoiceType: row.invoiceType,
    pointOfSale: row.pointOfSale,
    invoiceNumber: row.invoiceNumber,
    clientName: row.clientName,
    clientIdentificationType: row.clientIdentificationType,
    clientIdentificationNumber: row.clientIdentificationNumber,
    clientIvaCondition: row.clientIvaCondition,
    subtotal: row.subtotal.toNumber(),
    discountAmount: row.discountAmount.toNumber(),
    ivaPercent: row.ivaPercent.toNumber(),
    ivaAmount: row.ivaAmount.toNumber(),
    total: row.total.toNumber(),
    totalVisualRounded: row.totalVisualRounded.toNumber(),
  };
}

function noteLibroSource(row: {
  kind: BillingNoteKind;
  issuedAt: Date;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  noteNumber: string;
  invoice: { invoiceNumber: string };
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  netAmount: { toNumber: () => number };
  ivaPercent: { toNumber: () => number };
  ivaAmount: { toNumber: () => number };
  amount: { toNumber: () => number };
}) {
  return {
    kind: row.kind,
    issuedAt: row.issuedAt,
    invoiceType: row.invoiceType,
    pointOfSale: row.pointOfSale,
    noteNumber: row.noteNumber,
    invoiceNumber: row.invoice.invoiceNumber,
    clientName: row.clientName,
    clientIdentificationType: row.clientIdentificationType,
    clientIdentificationNumber: row.clientIdentificationNumber,
    clientIvaCondition: row.clientIvaCondition,
    netAmount: row.netAmount.toNumber(),
    ivaPercent: row.ivaPercent.toNumber(),
    ivaAmount: row.ivaAmount.toNumber(),
    amount: row.amount.toNumber(),
  };
}

async function main(): Promise<void> {
  assertDebitArtifactArgs(process.argv.slice(2));
  installFetchGuard();

  const { prisma } = await import("@/server/database/prisma");
  const { readActiveFiscalEnvironment, scopeFiscalDocuments, scopeInvoicesForFiscalEnvironment, scopeReceiptsToFiscalEnvironment } =
    await import("@/server/services/billing-fiscal-scope");
  const { billingInvoiceRepository } = await import(
    "@/server/repositories/billing-invoice.repository"
  );
  const { billingNoteRepository } = await import(
    "@/server/repositories/billing-note.repository"
  );
  const { billingReceiptRepository } = await import(
    "@/server/repositories/billing-receipt.repository"
  );
  const { arcaEmissionRepository } = await import(
    "@/server/arca/repositories/arca-emission.repository"
  );
  const { isArcaNoteBillingSnapshot } = await import(
    "@/server/arca/notes/note-payload-snapshot"
  );
  const { buildNotePdf } = await import("@/server/pdf/build-note-pdf");
  const { loadRothamelLogoPng } = await import("@/server/pdf/load-rothamel-logo");
  const { buildArcaNoteQrUrl, decodeArcaQrUrl } = await import(
    "@/server/arca/qr/build-arca-qr"
  );
  const { formatArcaVoucherDate } = await import(
    "@/server/arca/adapters/billing-invoice-to-cae"
  );
  const { buildLibroIvaPdf } = await import("@/server/pdf/build-libro-iva-pdf");
  const { buildLibroIvaXlsx } = await import("@/server/excel/build-libro-iva-xlsx");
  const { toBillingInvoiceListItem } = await import(
    "@/features/billing/types/billing-invoice.types"
  );
  const { toBillingNoteListItem } = await import(
    "@/features/billing/types/billing-note.types"
  );
  const { toBillingReceiptListItem } = await import(
    "@/features/billing/types/billing-receipt.types"
  );
  const { buildBillingDashboardMetrics } = await import(
    "@/features/billing/utils/billing-metrics"
  );
  const { buildDebtorClients } = await import("@/features/billing/utils/invoice-list");
  const { buildBillingMovements } = await import("@/features/billing/utils/movement-list");

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
    });

    if (!settings) {
      throw new ArtifactAbort("La configuración fiscal no está disponible.");
    }

    const settingsStamp = {
      environment: settings.environment,
      updatedAt: settings.updatedAt.getTime(),
    };
    const activeEnvironment = await readActiveFiscalEnvironment();

    if (activeEnvironment !== "PRODUCCION" || settings.environment !== "PRODUCCION") {
      throw new ArtifactAbort("BillingFiscalSettings no está en PRODUCCION.");
    }

    const note = await prisma.billingNote.findUnique({
      where: { id: HOMO_DEBIT_ARTIFACT_NOTE_ID },
      include: {
        invoice: { select: { invoiceNumber: true, invoiceType: true, issuedAt: true } },
      },
    });
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: HOMO_DEBIT_ARTIFACT_INVOICE_ID },
    });

    if (!note || !invoice || note.invoiceId !== invoice.id) {
      throw new ArtifactAbort("No están la nota de débito y su factura asociada.");
    }

    if (
      note.environment !== "HOMOLOGACION" ||
      note.fiscalStatus !== "AUTORIZADA" ||
      note.kind !== "DEBIT" ||
      note.voucherType !== 2 ||
      note.sequenceNumber !== 1 ||
      note.noteNumber !== HOMO_DEBIT_ARTIFACT_NOTE_NUMBER ||
      invoice.environment !== "HOMOLOGACION" ||
      invoice.fiscalStatus !== "AUTORIZADA" ||
      invoice.invoiceNumber !== HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER ||
      invoice.sequenceNumber !== 2 ||
      invoice.pointOfSale !== "0007" ||
      invoice.invoiceType !== "A" ||
      invoice.paymentMethod !== "CUENTA_CORRIENTE" ||
      invoice.paymentStatus !== "IMPAGA"
    ) {
      throw new ArtifactAbort("La nota o la factura no coinciden con la prueba.");
    }

    const noteCae = requireCae(note.cae, "La nota");
    requireCae(invoice.cae, "La factura");

    if (!note.caeExpiresAt) {
      throw new ArtifactAbort("La nota no tiene vencimiento de CAE.");
    }

    if (
      pesosToCents(note.amount.toNumber()) !== HOMO_DEBIT_ARTIFACT_NOTE_AMOUNT_CENTS ||
      pesosToCents(note.netAmount.toNumber()) !== HOMO_DEBIT_ARTIFACT_NOTE_NET_CENTS ||
      pesosToCents(note.ivaAmount.toNumber()) !== HOMO_DEBIT_ARTIFACT_NOTE_IVA_CENTS ||
      pesosToCents(invoice.totalVisualRounded.toNumber()) !== HOMO_DEBIT_ARTIFACT_INVOICE_TOTAL_CENTS
    ) {
      throw new ArtifactAbort("Los importes persistidos no son los de esta prueba.");
    }

    const emission = await arcaEmissionRepository.findByNoteId(note.id);
    const snapshot = emission?.billingPayloadSnapshot;

    if (
      !emission ||
      emission.status !== "COMPLETED" ||
      emission.environment !== "HOMOLOGACION" ||
      emission.voucherType !== 2 ||
      emission.voucherNumber !== 1 ||
      emission.noteId !== note.id ||
      !snapshot ||
      !isArcaNoteBillingSnapshot(snapshot)
    ) {
      throw new ArtifactAbort("La emisión de la nota no está completa en homologación.");
    }

    const issuer = snapshot.issuerSnapshot;

    if (!issuer.name.trim() || !issuer.cuit.trim()) {
      throw new ArtifactAbort("La nota autorizada no tiene el emisor fiscal de la emisión.");
    }

    const logoPng = await loadRothamelLogoPng();
    const pdfBytes = await buildNotePdf({
      kind: note.kind,
      noteNumber: note.noteNumber,
      invoiceType: note.invoiceType,
      invoiceNumber: note.invoice.invoiceNumber,
      issuedAt: note.issuedAt,
      amount: note.amount.toNumber(),
      netAmount: note.netAmount.toNumber(),
      ivaAmount: note.ivaAmount.toNumber(),
      ivaPercent: note.ivaPercent.toNumber(),
      reason: note.reason,
      clientName: note.clientName,
      clientCode: note.clientCode,
      clientIdentificationType: note.clientIdentificationType,
      clientIdentificationNumber: note.clientIdentificationNumber,
      clientIvaCondition: note.clientIvaCondition,
      issuer: {
        name: issuer.name,
        cuit: issuer.cuit,
        address: issuer.address,
        city: issuer.city,
        province: issuer.province,
        ivaCondition: issuer.ivaCondition,
        grossIncome: issuer.grossIncome,
        activitiesStartedAt: issuer.activitiesStartedAt,
      },
      logoPng,
      environment: note.environment,
      fiscalStatus: note.fiscalStatus,
      pointOfSale: note.pointOfSale,
      sequenceNumber: note.sequenceNumber,
      voucherType: note.voucherType,
      cae: note.cae,
      caeExpiresAt: note.caeExpiresAt,
      associatedIssuedAt: note.invoice.issuedAt,
    });
    const outputDir = path.join(os.tmpdir(), "rothamel-arca-homo");
    await mkdir(outputDir, { recursive: true });
    const notePdfPath = path.join(outputDir, "ND-A-0007-00000001.pdf");
    await writeFile(notePdfPath, pdfBytes);
    const pdfReport = assertDebitNotePdfText({
      text: pdfText(pdfBytes),
      cae: noteCae,
      expiration: formatCaeExpirationUtc(note.caeExpiresAt),
      issuerName: toWinAnsi(issuer.name),
      clientName: toWinAnsi(note.clientName),
      amountLabel: `$${formatPdfAmount(note.amount.toNumber())}`,
      netLabel: `Neto $${formatPdfAmount(note.netAmount.toNumber())}`,
      ivaLabel: `IVA ${note.ivaPercent.toNumber()}% $${formatPdfAmount(note.ivaAmount.toNumber())}`,
    });
    const compactIssuedAt = formatArcaVoucherDate(note.issuedAt);
    const expectedFecha = `${compactIssuedAt.slice(0, 4)}-${compactIssuedAt.slice(4, 6)}-${compactIssuedAt.slice(6, 8)}`;
    const receptor = receptorExpectation(
      note.clientIdentificationType,
      note.clientIdentificationNumber,
    );
    const qrPayload = decodeArcaQrUrl(
      buildArcaNoteQrUrl({
        fiscalStatus: "AUTORIZADA",
        environment: note.environment,
        kind: note.kind,
        invoiceType: note.invoiceType,
        voucherType: note.voucherType,
        cae: note.cae,
        pointOfSale: note.pointOfSale,
        sequenceNumber: note.sequenceNumber,
        amount: note.amount.toNumber(),
        issuedAt: note.issuedAt,
        issuerCuit: issuer.cuit,
        clientIdentificationType: note.clientIdentificationType,
        clientIdentificationNumber: note.clientIdentificationNumber,
      }),
    );
    const qrReport = formatDebitQrVerification({
      ver: qrPayload.ver,
      fecha: qrPayload.fecha,
      cuit: qrPayload.cuit,
      ptoVta: qrPayload.ptoVta,
      tipoCmp: qrPayload.tipoCmp,
      nroCmp: qrPayload.nroCmp,
      importe: qrPayload.importe,
      moneda: qrPayload.moneda,
      ctz: qrPayload.ctz,
      tipoCodAut: qrPayload.tipoCodAut,
      codAut: qrPayload.codAut,
      tipoDocRec: qrPayload.tipoDocRec,
      nroDocRec: qrPayload.nroDocRec,
      expectedFecha,
      expectedCaeDigits: noteCae.replace(/\D/g, ""),
      expectedIssuerCuitDigits: issuer.cuit.replace(/\D/g, ""),
      expectedReceptorDigits: receptor.digits,
      expectedReceptorDocType: receptor.docType,
    });
    const range = libroIvaMonthRange(HOMO_DEBIT_ARTIFACT_YEAR, HOMO_DEBIT_ARTIFACT_MONTH);
    const [homoInvoices, homoNotes, productionInvoices, productionNotes, productionReceipts, productionIssuedInvoices, productionIssuedNotes, numberedNotes] =
      await Promise.all([
        billingInvoiceRepository.findIssuedBetween(range.from, range.to, "HOMOLOGACION"),
        billingNoteRepository.findIssuedBetween(range.from, range.to, "HOMOLOGACION"),
        billingInvoiceRepository.findAllOrdered("PRODUCCION"),
        billingNoteRepository.findAllOrdered("PRODUCCION"),
        billingReceiptRepository.findAllOrdered("PRODUCCION"),
        billingInvoiceRepository.findIssuedBetween(range.from, range.to, "PRODUCCION"),
        billingNoteRepository.findIssuedBetween(range.from, range.to, "PRODUCCION"),
        prisma.billingNote.findMany({
          where: {
            environment: "HOMOLOGACION",
            pointOfSale: "0007",
            sequenceNumber: 1,
            noteNumber: HOMO_DEBIT_ARTIFACT_NOTE_NUMBER,
          },
          select: {
            id: true,
            environment: true,
            kind: true,
            voucherType: true,
            sequenceNumber: true,
            noteNumber: true,
          },
        }),
      ]);
    assertCreditAndDebitCoexist(
      numberedNotes.map((row) => {
        if (row.voucherType === null) {
          throw new ArtifactAbort("Una nota de homologación no tiene tipo de comprobante.");
        }

        return { ...row, voucherType: row.voucherType };
      }),
    );
    const libro = assessDebitHomologationLibro(
      homoInvoices.map(invoiceLibroSource),
      homoNotes.map(noteLibroSource),
    );
    const libroInput = {
      year: HOMO_DEBIT_ARTIFACT_YEAR,
      month: HOMO_DEBIT_ARTIFACT_MONTH,
      rows: libro.rows,
      issuer: {
        name: issuer.name,
        cuit: issuer.cuit,
        address: issuer.address,
        city: issuer.city,
        province: issuer.province,
        ivaCondition: issuer.ivaCondition,
        grossIncome: issuer.grossIncome,
        activitiesStartedAt: issuer.activitiesStartedAt,
      },
      environment: "HOMOLOGACION" as const,
      ivaPercent: settings.ivaPercent.toNumber(),
      pointOfSale: "0007",
    };
    const [libroPdf, libroXlsx] = await Promise.all([
      buildLibroIvaPdf(libroInput),
      buildLibroIvaXlsx(libroInput),
    ]);
    const libroPdfPath = path.join(outputDir, "Libro-IVA-HOMOLOGACION-2026-10.pdf");
    const libroXlsxPath = path.join(outputDir, "Libro-IVA-HOMOLOGACION-2026-10.xlsx");
    await writeFile(libroPdfPath, libroPdf);
    await writeFile(libroXlsxPath, libroXlsx);
    const libroPdfText = pdfText(libroPdf);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(libroXlsx) as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0],
    );
    const xlsxValues: string[] = [];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          xlsxValues.push(String(cell.value ?? ""));
        });
      });
    });
    const xlsxText = xlsxValues.join("\n");

    if (
      !libroPdfText.includes(HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER) ||
      !libroPdfText.includes("ND") ||
      !libroPdfText.includes("NC") ||
      !libroPdfText.includes(HOMO_DEBIT_ARTIFACT_NOTE_NUMBER) ||
      libroPdfText.includes("MODO PRUEBA")
    ) {
      throw new ArtifactAbort("El PDF del Libro IVA no refleja las filas de homologación.");
    }

    if (
      !xlsxText.includes(HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER) ||
      !xlsxText.includes("ND") ||
      !xlsxText.includes("NC") ||
      !xlsxValues.some((value) => value === "50" || value === "50.00" || value === "60.5" || value === "60.50")
    ) {
      throw new ArtifactAbort("El XLSX del Libro IVA no refleja la nota de débito.");
    }

    const scopedInvoices = scopeInvoicesForFiscalEnvironment(productionInvoices, "PRODUCCION");
    const scopedNotes = scopeFiscalDocuments(productionNotes, "PRODUCCION");
    const scopedReceipts = scopeReceiptsToFiscalEnvironment(productionReceipts, "PRODUCCION");
    const productionItems = scopedInvoices.map(toBillingInvoiceListItem);
    const metrics = buildBillingDashboardMetrics(productionItems);
    const debtors = buildDebtorClients(productionItems);
    const movements = buildBillingMovements(
      scopedReceipts.map(toBillingReceiptListItem),
      scopedNotes.map(toBillingNoteListItem),
    );
    const movementInvoiceIds = movements.flatMap((row) =>
      [row.invoiceId, ...row.invoices.map((link) => link.id)].filter(
        (id): id is string => id !== null,
      ),
    );

    assertProductionIsolationById({
      invoiceId: invoice.id,
      noteId: note.id,
      activeInvoiceIds: scopedInvoices.map((row) => row.id),
      activeNoteIds: scopedNotes.map((row) => row.id),
      dashboardInvoiceIds: metrics.unpaidInvoices.map((row) => row.id),
      debtorSourceInvoiceIds: productionItems.map((row) => row.id),
      movementIds: movements.map((row) => row.id),
      movementInvoiceIds,
      libroInvoiceIds: productionIssuedInvoices.map((row) => row.id),
      libroNoteIds: productionIssuedNotes.map((row) => row.id),
    });

    const sameNumberProduction = productionIssuedInvoices.find(
      (row) => row.invoiceNumber === note.noteNumber,
    );

    if (sameNumberProduction && sameNumberProduction.id === note.id) {
      throw new ArtifactAbort("La nota de homologación quedó identificada como la factura productiva.");
    }

    const [credits, debits, allocated] = await Promise.all([
      prisma.billingNote.aggregate({
        where: { invoiceId: invoice.id, kind: "CREDIT", fiscalStatus: "AUTORIZADA" },
        _sum: { amount: true },
      }),
      prisma.billingNote.aggregate({
        where: { invoiceId: invoice.id, kind: "DEBIT", fiscalStatus: "AUTORIZADA" },
        _sum: { amount: true },
      }),
      prisma.billingReceiptAllocation.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amount: true },
      }),
    ]);
    const outstanding = assertDebitNoteBalance({
      totalCents: pesosToCents(invoice.totalVisualRounded.toNumber()),
      creditCents: pesosToCents(credits._sum.amount?.toNumber() ?? 0),
      debitCents: pesosToCents(debits._sum.amount?.toNumber() ?? 0),
      allocatedCents: pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
      fiscalStatus: invoice.fiscalStatus,
      paymentMethod: invoice.paymentMethod,
      paymentStatus: invoice.paymentStatus,
    });
    const after = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: { environment: true, updatedAt: true },
    });

    if (
      !after ||
      after.environment !== settingsStamp.environment ||
      after.updatedAt.getTime() !== settingsStamp.updatedAt
    ) {
      throw new ArtifactAbort("BillingFiscalSettings cambió durante la verificación.");
    }

    console.log(
      [
        "STATUS: VERIFIED",
        `environment activo: ${activeEnvironment}`,
        `flag notas produccion: ${productionFlagLabel(process.env.ARCA_NOTE_PRODUCTION_EMISSION_ENABLED)}`,
        "NOTA",
        `id: ${note.id}`,
        `numero: ${note.noteNumber}`,
        `kind: ${note.kind}`,
        `voucherType: ${note.voucherType}`,
        `secuencia: ${note.sequenceNumber}`,
        `environment: ${note.environment}`,
        `estado: ${note.fiscalStatus}`,
        "CAE PRESENTE: true",
        `importe centavos: ${HOMO_DEBIT_ARTIFACT_NOTE_AMOUNT_CENTS}`,
        "FACTURA",
        `id: ${invoice.id}`,
        `numero: ${invoice.invoiceNumber}`,
        `environment: ${invoice.environment}`,
        `tipo: ${invoice.invoiceType}`,
        `punto de venta: ${invoice.pointOfSale}`,
        `secuencia: ${invoice.sequenceNumber}`,
        `estado: ${invoice.fiscalStatus}`,
        `forma de pago: ${invoice.paymentMethod}`,
        `estado de pago: ${invoice.paymentStatus}`,
        `PDF: ${notePdfPath}`,
        pdfReport,
        qrReport,
        "issuer source: EMISSION SNAPSHOT",
        "LIBRO IVA HOMOLOGACION",
        ...libro.lines,
        `solo los cuatro conocidos: ${libro.onlyKnownFour ? "sí" : "no"}`,
        `neto: ${libro.totals.netAmount.toFixed(2)}`,
        `iva: ${libro.totals.ivaAmount.toFixed(2)}`,
        `total: ${libro.totals.total.toFixed(2)}`,
        `Libro IVA PDF: ${libroPdfPath}`,
        `Libro IVA XLSX: ${libroXlsxPath}`,
        "PDF y XLSX salen de las mismas filas",
        "AISLAMIENTO",
        "factura homo en listado activo: no",
        "nota homo en listado activo: no",
        "factura homo en dashboard: no",
        "factura homo en deudores: no",
        "factura homo en movimientos: no",
        "nota homo en movimientos: no",
        "ids en libro IVA produccion: no",
        `factura productiva con el mismo numero visible: ${sameNumberProduction ? sameNumberProduction.id : "no"}`,
        `clientes con deuda productiva: ${debtors.length}`,
        "NC Y ND",
        "NC A tipo 3 secuencia 1: sí",
        "ND A tipo 2 secuencia 1: sí",
        "documentos distintos: sí",
        "SALDO",
        "121000 + 6050 = 127050",
        `outstandingCents: ${outstanding}`,
        `fiscalStatus: ${invoice.fiscalStatus}`,
        "red: 0",
        "escrituras db: 0",
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "error";
  console.error(`ABORTO: ${message.replace(/\b\d{10,}\b/g, "[redactado]")}`);
  process.exit(1);
});
