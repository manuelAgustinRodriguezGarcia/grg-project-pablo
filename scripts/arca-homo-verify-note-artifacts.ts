/**
 * Verificación read-only de la NC A ya autorizada en homologación.
 * Genera el PDF fiscal y el Libro IVA fuera del repositorio.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-verify-note-artifacts.ts
 *
 * Los imports de base y PDF entran después del guard de red para abortar
 * antes de cualquier fetch. No hay una dependencia circular.
 */
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import ExcelJS from "exceljs";
import { libroIvaMonthRange } from "@/features/billing/utils/libro-iva";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { ARCA_DOCUMENT_TYPE } from "@/shared/fiscal/arca-fiscal-mapping";
import {
  ArtifactAbort,
  HOMO_ARTIFACT_ENVIRONMENT,
  HOMO_ARTIFACT_INVOICE_NUMBER,
  HOMO_ARTIFACT_INVOICE_TOTAL_CENTS,
  HOMO_ARTIFACT_MONTH,
  HOMO_ARTIFACT_NOTE_AMOUNT_CENTS,
  HOMO_ARTIFACT_NOTE_IVA_CENTS,
  HOMO_ARTIFACT_NOTE_NET_CENTS,
  HOMO_ARTIFACT_NOTE_NUMBER,
  HOMO_ARTIFACT_POINT_OF_SALE,
  HOMO_ARTIFACT_SEQUENCE,
  HOMO_ARTIFACT_YEAR,
  assertExpectedBalance,
  assertNotePdfText,
  assertSingleMatch,
  assertVerifyArtifactsArgs,
  assessHomologationLibro,
  formatCaeExpirationUtc,
  formatQrVerification,
  installFetchGuard,
  pdfText,
  productionFlagLabel,
} from "./arca-homo-verify-note-artifacts-plan";

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

async function main(): Promise<void> {
  assertVerifyArtifactsArgs(process.argv.slice(2));
  installFetchGuard();

  const { prisma } = await import("@/server/database/prisma");
  const { BILLING_FISCAL_SETTINGS_ID } = await import(
    "@/server/repositories/billing-fiscal-settings.repository"
  );
  const { readActiveFiscalEnvironment, scopeFiscalDocuments, scopeInvoicesForFiscalEnvironment } =
    await import("@/server/services/billing-fiscal-scope");
  const { billingInvoiceRepository } = await import(
    "@/server/repositories/billing-invoice.repository"
  );
  const { billingNoteRepository } = await import(
    "@/server/repositories/billing-note.repository"
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
  const { buildBillingDashboardMetrics } = await import(
    "@/features/billing/utils/billing-metrics"
  );
  const { buildDebtorClients } = await import("@/features/billing/utils/invoice-list");
  const { buildLibroIvaRows } = await import("@/features/billing/utils/libro-iva");

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: BILLING_FISCAL_SETTINGS_ID },
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

    const invoices = await prisma.billingInvoice.findMany({
      where: {
        environment: HOMO_ARTIFACT_ENVIRONMENT,
        invoiceType: "A",
        pointOfSale: HOMO_ARTIFACT_POINT_OF_SALE,
        sequenceNumber: HOMO_ARTIFACT_SEQUENCE,
        invoiceNumber: HOMO_ARTIFACT_INVOICE_NUMBER,
      },
    });
    const invoice = assertSingleMatch(invoices, "la factura A 0007-00000001");

    if (invoice.fiscalStatus !== "AUTORIZADA") {
      throw new ArtifactAbort("La factura no está autorizada.");
    }

    requireCae(invoice.cae, "La factura");

    const notes = await prisma.billingNote.findMany({
      where: {
        environment: HOMO_ARTIFACT_ENVIRONMENT,
        kind: "CREDIT",
        voucherType: 3,
        pointOfSale: HOMO_ARTIFACT_POINT_OF_SALE,
        sequenceNumber: HOMO_ARTIFACT_SEQUENCE,
        noteNumber: HOMO_ARTIFACT_NOTE_NUMBER,
        invoiceId: invoice.id,
      },
      include: {
        invoice: { select: { invoiceNumber: true, invoiceType: true, issuedAt: true } },
      },
    });
    const note = assertSingleMatch(notes, "la NC A 0007-00000001");

    if (note.fiscalStatus !== "AUTORIZADA") {
      throw new ArtifactAbort("La nota no está autorizada.");
    }

    const noteCae = requireCae(note.cae, "La nota");

    if (!note.caeExpiresAt) {
      throw new ArtifactAbort("La nota no tiene vencimiento de CAE.");
    }

    if (
      pesosToCents(note.amount.toNumber()) !== HOMO_ARTIFACT_NOTE_AMOUNT_CENTS ||
      pesosToCents(note.netAmount.toNumber()) !== HOMO_ARTIFACT_NOTE_NET_CENTS ||
      pesosToCents(note.ivaAmount.toNumber()) !== HOMO_ARTIFACT_NOTE_IVA_CENTS ||
      pesosToCents(invoice.totalVisualRounded.toNumber()) !== HOMO_ARTIFACT_INVOICE_TOTAL_CENTS
    ) {
      throw new ArtifactAbort("Los importes persistidos no son los de esta prueba.");
    }

    const emission = await arcaEmissionRepository.findByNoteId(note.id);
    const snapshot = emission?.billingPayloadSnapshot;

    if (
      !emission ||
      emission.status !== "COMPLETED" ||
      emission.environment !== HOMO_ARTIFACT_ENVIRONMENT ||
      emission.voucherType !== 3 ||
      emission.voucherNumber !== 1 ||
      !snapshot ||
      !isArcaNoteBillingSnapshot(snapshot)
    ) {
      throw new ArtifactAbort("La emisión de la nota no está completa en homologación.");
    }

    const issuer = snapshot.issuerSnapshot;

    if (!issuer.name.trim() || !issuer.cuit.trim()) {
      throw new ArtifactAbort("La nota autorizada no tiene el emisor fiscal de la emisión.");
    }

    const issuerMatchesSettings =
      issuer.name === (settings.issuerName ?? "") &&
      issuer.cuit === (settings.issuerCuit ?? "") &&
      issuer.address === (settings.issuerAddress ?? "") &&
      issuer.city === (settings.issuerCity ?? "") &&
      issuer.province === (settings.issuerProvince ?? "") &&
      issuer.ivaCondition === (settings.issuerIvaCondition ?? "") &&
      issuer.grossIncome === (settings.issuerGrossIncome ?? "") &&
      issuer.activitiesStartedAt === (settings.issuerActivitiesStartedAt ?? "");
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
    const notePdfPath = path.join(outputDir, "NC-A-0007-00000001.pdf");
    await writeFile(notePdfPath, pdfBytes);
    const pdfReport = assertNotePdfText({
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
    const qrReport = formatQrVerification({
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
    const range = libroIvaMonthRange(HOMO_ARTIFACT_YEAR, HOMO_ARTIFACT_MONTH);
    const [homoInvoices, homoNotes, productionInvoices, productionNotes, productionIssuedInvoices, productionIssuedNotes] =
      await Promise.all([
        billingInvoiceRepository.findIssuedBetween(
          range.from,
          range.to,
          HOMO_ARTIFACT_ENVIRONMENT,
        ),
        billingNoteRepository.findIssuedBetween(
          range.from,
          range.to,
          HOMO_ARTIFACT_ENVIRONMENT,
        ),
        billingInvoiceRepository.findAllOrdered("PRODUCCION"),
        billingNoteRepository.findAllOrdered("PRODUCCION"),
        billingInvoiceRepository.findIssuedBetween(range.from, range.to, "PRODUCCION"),
        billingNoteRepository.findIssuedBetween(range.from, range.to, "PRODUCCION"),
      ]);
    const libro = assessHomologationLibro(
      homoInvoices.map((row) => ({
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
      })),
      homoNotes
        .filter((row) => row.fiscalStatus === "AUTORIZADA")
        .map((row) => ({
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
        })),
    );
    const libroIssuer = {
      name: issuer.name,
      cuit: issuer.cuit,
      address: issuer.address,
      city: issuer.city,
      province: issuer.province,
      ivaCondition: issuer.ivaCondition,
      grossIncome: issuer.grossIncome,
      activitiesStartedAt: issuer.activitiesStartedAt,
    };
    const libroInput = {
      year: HOMO_ARTIFACT_YEAR,
      month: HOMO_ARTIFACT_MONTH,
      rows: buildLibroIvaRows(
        homoInvoices.map((row) => ({
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
        })),
        homoNotes
          .filter((row) => row.fiscalStatus === "AUTORIZADA")
          .map((row) => ({
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
          })),
      ),
      issuer: libroIssuer,
      environment: HOMO_ARTIFACT_ENVIRONMENT,
      ivaPercent: settings.ivaPercent.toNumber(),
      pointOfSale: HOMO_ARTIFACT_POINT_OF_SALE,
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
      !libroPdfText.includes(HOMO_ARTIFACT_INVOICE_NUMBER) ||
      !libroPdfText.includes("NC") ||
      !libroPdfText.includes(formatPdfAmount(-100)) ||
      libroPdfText.includes("PRODUCCION") ||
      libroPdfText.includes("MODO PRUEBA")
    ) {
      throw new ArtifactAbort("El PDF del Libro IVA no refleja las filas de homologación.");
    }

    if (
      !xlsxText.includes(HOMO_ARTIFACT_NOTE_NUMBER) ||
      !xlsxValues.some((value) => value === "-100" || value === "-121" || value.includes("-100"))
    ) {
      throw new ArtifactAbort("El XLSX del Libro IVA no refleja el signo de la NC.");
    }

    const scopedInvoices = scopeInvoicesForFiscalEnvironment(
      productionInvoices,
      "PRODUCCION",
    );
    const scopedNotes = scopeFiscalDocuments(productionNotes, "PRODUCCION");
    const productionItems = scopedInvoices.map(toBillingInvoiceListItem);
    const metrics = buildBillingDashboardMetrics(productionItems);
    const debtors = buildDebtorClients(productionItems);
    const productionLibro = buildLibroIvaRows(
      productionIssuedInvoices.map((row) => ({
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
      })),
      productionIssuedNotes.map((row) => ({
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
      })),
    );
    const homoInvoiceInProduction = scopedInvoices.some((row) => row.id === invoice.id);
    const homoNoteInProduction = scopedNotes.some((row) => row.id === note.id);
    const homoInvoiceInMetrics = productionItems.some((row) => row.id === invoice.id);
    const homoInvoiceInDebt = debtors.some((row) =>
      productionItems.some(
        (item) => item.id === invoice.id && item.clientId === row.clientId,
      ),
    );
    const homoInProductionLibro = productionIssuedInvoices.some((row) => row.id === invoice.id) ||
      productionIssuedNotes.some((row) => row.id === note.id);

    if (
      homoInvoiceInProduction ||
      homoNoteInProduction ||
      homoInvoiceInMetrics ||
      homoInvoiceInDebt ||
      homoInProductionLibro
    ) {
      throw new ArtifactAbort("Un comprobante de homologación aparece en el alcance productivo.");
    }

    const [credits, debits, allocated] = await Promise.all([
      prisma.billingNote.aggregate({
        where: { invoiceId: invoice.id, kind: "CREDIT" },
        _sum: { amount: true },
      }),
      prisma.billingNote.aggregate({
        where: { invoiceId: invoice.id, kind: "DEBIT" },
        _sum: { amount: true },
      }),
      prisma.billingReceiptAllocation.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amount: true },
      }),
    ]);
    const outstanding = assertExpectedBalance({
      totalCents: pesosToCents(invoice.totalVisualRounded.toNumber()),
      creditCents: pesosToCents(credits._sum.amount?.toNumber() ?? 0),
      debitCents: pesosToCents(debits._sum.amount?.toNumber() ?? 0),
      allocatedCents: pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
      fiscalStatus: invoice.fiscalStatus,
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
        "FACTURA",
        `numero: ${invoice.invoiceNumber}`,
        `environment: ${invoice.environment}`,
        `tipo: ${invoice.invoiceType}`,
        `punto de venta: ${invoice.pointOfSale}`,
        `secuencia: ${invoice.sequenceNumber}`,
        `estado: ${invoice.fiscalStatus}`,
        "CAE PRESENTE: true",
        `total centavos: ${HOMO_ARTIFACT_INVOICE_TOTAL_CENTS}`,
        "NOTA",
        `numero: ${note.noteNumber}`,
        `kind: ${note.kind}`,
        `voucherType: ${note.voucherType}`,
        `secuencia: ${note.sequenceNumber}`,
        `estado: ${note.fiscalStatus}`,
        "CAE PRESENTE: true",
        `importe centavos: ${HOMO_ARTIFACT_NOTE_AMOUNT_CENTS}`,
        `neto centavos: ${HOMO_ARTIFACT_NOTE_NET_CENTS}`,
        `iva centavos: ${HOMO_ARTIFACT_NOTE_IVA_CENTS}`,
        `PDF: ${notePdfPath}`,
        pdfReport,
        qrReport,
        "issuer source: EMISSION SNAPSHOT",
        `snapshot igual a settings vigentes: ${issuerMatchesSettings ? "sí" : "no"}`,
        "LIBRO IVA HOMOLOGACION",
        ...libro.lines,
        `solo el par conocido: ${libro.onlyKnownPair ? "sí" : "no"}`,
        `neto: ${libro.totals.netAmount.toFixed(2)}`,
        `iva: ${libro.totals.ivaAmount.toFixed(2)}`,
        `total: ${libro.totals.total.toFixed(2)}`,
        `Libro IVA PDF: ${libroPdfPath}`,
        `Libro IVA XLSX: ${libroXlsxPath}`,
        "PDF y XLSX salen de las mismas filas",
        "AISLAMIENTO",
        "factura homo en listado activo: no",
        "nota homo en listado activo: no",
        `facturas productivas: ${scopedInvoices.length}`,
        `notas productivas: ${scopedNotes.length}`,
        `métricas productivas incluyen la factura: no`,
        `facturas del mes en métricas: ${metrics.invoiceCount}`,
        `deuda productiva incluye la factura: no`,
        `clientes con deuda productiva: ${debtors.length}`,
        `libro IVA productivo de octubre incluye estos comprobantes: no`,
        `filas del libro productivo: ${productionLibro.length}`,
        "SALDO",
        "121000 - 12100 = 108900",
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
