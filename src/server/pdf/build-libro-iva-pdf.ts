import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import {
  buildLibroIvaAbSummary,
  buildLibroIvaDailyBlocks,
  buildLibroIvaZSimpleSections,
  libroIvaDocKindLabel,
  libroIvaRowsForLetter,
  sumLibroIvaRows,
  type LibroIvaAbSummary,
  type LibroIvaDailyBlock,
  type LibroIvaDailyReportVariant,
  type LibroIvaRow,
  type LibroIvaZSimpleRow,
  type LibroIvaZSimpleSection,
} from "@/features/billing/utils/libro-iva";
import { formatPdfQuantity } from "@/features/billing/utils/pdf-money";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import {
  issuerFiscalLines,
  issuerLocationLine,
} from "@/server/pdf/invoice-pdf-issuer";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";
import {
  PAGE_MARGIN,
  PDF_AMBER,
  PDF_AMBER_BG,
  PDF_BLUE,
  PDF_GRAY,
  PDF_LINE,
  PDF_MUTED,
  PDF_NAVY,
  drawPdfAmountCell,
  drawPdfText,
  formatPdfDate,
} from "@/server/pdf/pdf-layout";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const TEST_BANNER = "MODO PRUEBA - NO VALIDO COMO LIBRO IVA FISCAL";
const ROW_HEIGHT = 14;
const HEADER_HEIGHT = 18;
const FONT_SIZE = 7;
const MONEY_KEYS = new Set(["neto", "ivaAmt", "total"]);

const AB_SUMMARY_COLUMNS = [
  { key: "pv", label: "PTO. VENTA", width: 90 },
  { key: "letter", label: "FACTURAS", width: 80 },
  { key: "total", label: "IMPORTE TOTAL", width: 150 },
  { key: "ivaPct", label: "% IVA", width: 70 },
  { key: "neto", label: "IMPORTE S/IVA", width: 150 },
  { key: "ivaAmt", label: "VALOR DE IVA", width: 150 },
] as const;

const MONTHLY_COLUMNS = [
  { key: "fecha", label: "Fecha", width: 46 },
  { key: "tipo", label: "Tipo", width: 34 },
  { key: "letra", label: "Letra", width: 26 },
  { key: "pv", label: "PV", width: 28 },
  { key: "numero", label: "Numero", width: 96 },
  { key: "cliente", label: "Cliente", width: 74 },
  { key: "id", label: "CUIT/DNI", width: 66 },
  { key: "iva", label: "Cond. IVA", width: 42 },
  { key: "ivaPct", label: "IVA %", width: 34 },
  { key: "neto", label: "NETO S/IVA", width: 86 },
  { key: "ivaAmt", label: "VALOR DE IVA", width: 86 },
  { key: "total", label: "Total", width: 82 },
  { key: "asociado", label: "Asociado", width: 52 },
] as const;

const DAILY_COLUMNS = [
  { key: "pv", label: "PV", width: 36 },
  { key: "numero", label: "Numero", width: 118 },
  { key: "cliente", label: "Cliente", width: 102 },
  { key: "id", label: "CUIT/DNI", width: 80 },
  { key: "iva", label: "Cond. IVA", width: 62 },
  { key: "ivaPct", label: "IVA %", width: 40 },
  { key: "neto", label: "NETO S/IVA", width: 104 },
  { key: "ivaAmt", label: "VALOR DE IVA", width: 104 },
  { key: "total", label: "Total", width: 100 },
] as const;

const DAILY_COLUMNS_WITH_LETTER = [
  { key: "letra", label: "Letra", width: 32 },
  { key: "pv", label: "PV", width: 32 },
  { key: "numero", label: "Numero", width: 108 },
  { key: "cliente", label: "Cliente", width: 94 },
  { key: "id", label: "CUIT/DNI", width: 76 },
  { key: "iva", label: "Cond. IVA", width: 58 },
  { key: "ivaPct", label: "IVA %", width: 36 },
  { key: "neto", label: "NETO S/IVA", width: 100 },
  { key: "ivaAmt", label: "VALOR DE IVA", width: 100 },
  { key: "total", label: "Total", width: 96 },
] as const;

type MonthlyColumnKey = (typeof MONTHLY_COLUMNS)[number]["key"];
type DailyColumnKey =
  | (typeof DAILY_COLUMNS)[number]["key"]
  | (typeof DAILY_COLUMNS_WITH_LETTER)[number]["key"];

function dailyColumnsForBlock(block: LibroIvaDailyBlock) {
  return block.showLetterColumn ? DAILY_COLUMNS_WITH_LETTER : DAILY_COLUMNS;
}

export type LibroIvaPdfInput = {
  year: number;
  month: number;
  rows: LibroIvaRow[];
  issuer: InvoicePdfIssuer;
  environment: BillingFiscalEnvironment;
  ivaPercent: number;
  pointOfSale: string;
  periodText?: string;
};

export type LibroIvaDailyPdfInput = {
  year: number;
  month: number;
  day: number;
  rows: LibroIvaRow[];
  issuer: InvoicePdfIssuer;
  environment: BillingFiscalEnvironment;
  variant?: LibroIvaDailyReportVariant;
};

function monthlyCellText(row: LibroIvaRow, key: MonthlyColumnKey): string {
  switch (key) {
    case "fecha":
      return formatPdfDate(row.issuedAt);
    case "tipo":
      return libroIvaDocKindLabel(row.docKind);
    case "letra":
      return row.letter;
    case "pv":
      return row.pointOfSale;
    case "numero":
      return row.number;
    case "cliente":
      return row.clientName;
    case "id":
      return row.identification;
    case "iva":
      return row.ivaCondition;
    case "ivaPct":
      return `${formatPdfQuantity(row.ivaPercent)}%`;
    case "neto":
    case "ivaAmt":
    case "total":
      return "";
    case "asociado":
      return row.associatedNumber || "—";
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function dailyCellText(row: LibroIvaRow, key: DailyColumnKey): string {
  switch (key) {
    case "letra":
      return row.letter;
    case "pv":
      return row.pointOfSale;
    case "numero":
      return row.number;
    case "cliente":
      return row.clientName;
    case "id":
      return row.identification;
    case "iva":
      return row.ivaCondition;
    case "ivaPct":
      return `${formatPdfQuantity(row.ivaPercent)}%`;
    case "neto":
    case "ivaAmt":
    case "total":
      return "";
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function moneyValue(row: LibroIvaRow, key: "neto" | "ivaAmt" | "total"): number {
  switch (key) {
    case "neto":
      return row.netAmount;
    case "ivaAmt":
      return row.ivaAmount;
    case "total":
      return row.total;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function periodLabel(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toLocaleUpperCase("es-AR") + label.slice(1);
}

function dayLabel(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function firstContentY(testMode: boolean): number {
  let y = PAGE_HEIGHT - PAGE_MARGIN;
  if (testMode) {
    y -= 28;
  }
  return y - 52;
}

function pageCountForRows(rowCount: number, testMode: boolean): number {
  if (rowCount === 0) {
    return 1;
  }

  let pages = 1;
  let y = firstContentY(testMode) - HEADER_HEIGHT;
  for (let index = 0; index < rowCount; index += 1) {
    if (y < PAGE_MARGIN + 48) {
      pages += 1;
      y = firstContentY(testMode) - HEADER_HEIGHT;
    }
    y -= ROW_HEIGHT;
  }
  if (y < PAGE_MARGIN + 36) {
    pages += 1;
  }
  return pages;
}

export async function buildLibroIvaPdf(
  input: LibroIvaPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const testMode = input.environment === "MODO_PRUEBA";
  const period = input.periodText ?? periodLabel(input.year, input.month);

  const sheets = (["A", "B"] as const).map((letter) => ({
    title: `Facturas ${letter}`,
    rows: libroIvaRowsForLetter(input.rows, letter),
  }));
  const sheetPageCounts = sheets.map((sheet) =>
    pageCountForRows(sheet.rows.length, testMode),
  );
  const documentPageCount =
    sheetPageCounts.reduce((total, count) => total + count, 0) + 1;
  const summary = buildLibroIvaAbSummary(input.rows, {
    pointOfSale: input.pointOfSale,
    ivaPercent: input.ivaPercent,
  });

  let pageOffset = 0;
  for (const [index, sheet] of sheets.entries()) {
    drawMonthlySheet(pdf, {
      title: sheet.title,
      rows: sheet.rows,
      period,
      issuer: input.issuer,
      testMode,
      font,
      bold,
      pageOffset,
      documentPageCount,
    });
    pageOffset += sheetPageCounts[index] ?? 1;
  }

  drawAbSummaryPage(pdf, {
    summary,
    period,
    issuer: input.issuer,
    testMode,
    font,
    bold,
    pageNumber: pageOffset + 1,
    documentPageCount,
  });

  return pdf.save();
}

const Z_SIMPLE_COLUMNS = [
  { key: "tipo", label: "Tipo", width: 84 },
  { key: "numberFrom", label: "N° Desde", width: 118 },
  { key: "numberTo", label: "N° Hasta", width: 118 },
  { key: "ivaPct", label: "IVA %", width: 46 },
  { key: "neto", label: "Neto S/IVA", width: 124 },
  { key: "ivaAmt", label: "IVA", width: 124 },
  { key: "total", label: "TOTAL", width: 124 },
] as const;

type ZSimpleColumnKey = (typeof Z_SIMPLE_COLUMNS)[number]["key"];

export async function buildLibroIvaDailyPdf(
  input: LibroIvaDailyPdfInput,
): Promise<Uint8Array> {
  const variant = input.variant ?? "simple";
  if (variant === "detailed") {
    return buildLibroIvaDailyDetailedPdf(input);
  }
  return buildLibroIvaDailySimplePdf(input);
}

async function buildLibroIvaDailyDetailedPdf(
  input: LibroIvaDailyPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const testMode = input.environment === "MODO_PRUEBA";
  const blocks = buildLibroIvaDailyBlocks(input.rows);
  const period = dayLabel(input.year, input.month, input.day);
  const documentPageCount = countDailyPages(blocks, testMode);
  const subtitle = "Informe Z detallado";

  let pageIndex = 1;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawSharedHeader(page, {
    title: "LIBRO IVA DIARIO",
    subtitle,
    period,
    pageLabel: `Pagina ${pageIndex} de ${documentPageCount}`,
    issuer: input.issuer,
    testMode,
    font,
    bold,
  });

  for (const [index, block] of blocks.entries()) {
    const blockHeight = estimateDailyBlockHeight(block);
    if (index > 0) {
      y -= 16;
    }

    if (y - blockHeight < PAGE_MARGIN + 24) {
      pageIndex += 1;
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawSharedHeader(page, {
        title: "LIBRO IVA DIARIO",
        subtitle,
        period,
        pageLabel: `Pagina ${pageIndex} de ${documentPageCount}`,
        issuer: input.issuer,
        testMode,
        font,
        bold,
      });
    }
    y = drawDailyBlock(page, y, block, font, bold);
  }

  return pdf.save();
}

async function buildLibroIvaDailySimplePdf(
  input: LibroIvaDailyPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const testMode = input.environment === "MODO_PRUEBA";
  const sections = buildLibroIvaZSimpleSections(input.rows);
  const period = dayLabel(input.year, input.month, input.day);
  const documentPageCount = countZSimplePages(sections, testMode);
  const subtitle = "Informe Z simple";

  let pageIndex = 1;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawSharedHeader(page, {
    title: "LIBRO IVA DIARIO",
    subtitle,
    period,
    pageLabel: `Pagina ${pageIndex} de ${documentPageCount}`,
    issuer: input.issuer,
    testMode,
    font,
    bold,
  });

  for (const [index, section] of sections.entries()) {
    const sectionHeight = estimateZSimpleSectionHeight(section);
    if (index > 0) {
      y -= 16;
    }

    if (y - sectionHeight < PAGE_MARGIN + 24) {
      pageIndex += 1;
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawSharedHeader(page, {
        title: "LIBRO IVA DIARIO",
        subtitle,
        period,
        pageLabel: `Pagina ${pageIndex} de ${documentPageCount}`,
        issuer: input.issuer,
        testMode,
        font,
        bold,
      });
    }
    y = drawZSimpleSection(page, y, section, font, bold);
  }

  return pdf.save();
}

function estimateZSimpleSectionHeight(section: LibroIvaZSimpleSection): number {
  const titleAndHeader = 10 + HEADER_HEIGHT;
  if (section.rows.length === 0) {
    return titleAndHeader + 52;
  }
  return titleAndHeader + section.rows.length * ROW_HEIGHT + 34;
}

function countZSimplePages(
  sections: LibroIvaZSimpleSection[],
  testMode: boolean,
): number {
  let pages = 1;
  let y = firstContentY(testMode);

  for (const [index, section] of sections.entries()) {
    const sectionHeight = estimateZSimpleSectionHeight(section);
    if (index > 0) {
      y -= 16;
    }
    if (y - sectionHeight < PAGE_MARGIN + 24) {
      pages += 1;
      y = firstContentY(testMode);
    }
    y -= sectionHeight;
  }

  return pages;
}

function zSimpleCellText(row: LibroIvaZSimpleRow, key: ZSimpleColumnKey): string {
  switch (key) {
    case "tipo":
      return row.tipo;
    case "numberFrom":
      return row.numberFrom;
    case "numberTo":
      return row.numberTo;
    case "ivaPct":
      return `${formatPdfQuantity(row.ivaPercent)}%`;
    case "neto":
    case "ivaAmt":
    case "total":
      return "";
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function zSimpleMoneyValue(
  row: LibroIvaZSimpleRow,
  key: "neto" | "ivaAmt" | "total",
): number {
  switch (key) {
    case "neto":
      return row.netAmount;
    case "ivaAmt":
      return row.ivaAmount;
    case "total":
      return row.total;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function drawZSimpleSection(
  page: PDFPage,
  startY: number,
  section: LibroIvaZSimpleSection,
  font: PDFFont,
  bold: PDFFont,
): number {
  let y = startY;
  drawPdfText(page, section.title, {
    x: PAGE_MARGIN,
    y,
    size: 9,
    font: bold,
    color: PDF_BLUE,
  });
  y -= 10;
  drawTableHeader(page, y, bold, Z_SIMPLE_COLUMNS);
  y -= HEADER_HEIGHT;

  if (section.rows.length === 0) {
    drawPdfText(page, "Sin comprobantes.", {
      x: PAGE_MARGIN + 4,
      y: y - 10,
      size: 8,
      font,
      color: PDF_GRAY,
    });
    drawZSimpleTotals(page, y - 28, section.totals, bold);
    return y - 52;
  }

  for (const [index, row] of section.rows.entries()) {
    let x = PAGE_MARGIN + 4;
    if (index % 2 === 1) {
      page.drawRectangle({
        x: PAGE_MARGIN,
        y: y - ROW_HEIGHT + 4,
        width: CONTENT_WIDTH,
        height: ROW_HEIGHT,
        color: PDF_MUTED,
      });
    }
    for (const column of Z_SIMPLE_COLUMNS) {
      if (MONEY_KEYS.has(column.key)) {
        drawPdfAmountCell(
          page,
          zSimpleMoneyValue(row, column.key as "neto" | "ivaAmt" | "total"),
          {
            x,
            y: y - 6,
            width: column.width - 8,
            size: FONT_SIZE,
            font,
            color: PDF_NAVY,
          },
        );
      } else {
        drawPdfText(page, zSimpleCellText(row, column.key), {
          x,
          y: y - 6,
          size: FONT_SIZE,
          font,
          maxWidth: column.width - 6,
        });
      }
      x += column.width;
    }
    y -= ROW_HEIGHT;
  }

  drawZSimpleTotals(page, y - 10, section.totals, bold);
  return y - 34;
}

function drawZSimpleTotals(
  page: PDFPage,
  y: number,
  totals: ReturnType<typeof sumLibroIvaRows>,
  bold: PDFFont,
): void {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 16,
    width: CONTENT_WIDTH,
    height: 20,
    color: PDF_MUTED,
  });
  drawPdfText(page, "Total", {
    x: PAGE_MARGIN + 4,
    y: y - 9,
    size: 8,
    font: bold,
    color: PDF_NAVY,
  });

  let x = PAGE_MARGIN + 4;
  for (const column of Z_SIMPLE_COLUMNS) {
    if (column.key === "neto") {
      drawPdfAmountCell(page, totals.netAmount, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: bold,
        color: PDF_NAVY,
      });
    } else if (column.key === "ivaAmt") {
      drawPdfAmountCell(page, totals.ivaAmount, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: bold,
        color: PDF_NAVY,
      });
    } else if (column.key === "total") {
      drawPdfAmountCell(page, totals.total, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: bold,
        color: PDF_NAVY,
      });
    }
    x += column.width;
  }
}

function estimateDailyBlockHeight(block: LibroIvaDailyBlock): number {
  const titleAndHeader = 10 + HEADER_HEIGHT;
  if (block.displayRows.length === 0) {
    return titleAndHeader + 28;
  }
  return titleAndHeader + block.displayRows.length * ROW_HEIGHT + 24;
}

function countDailyPages(
  blocks: LibroIvaDailyBlock[],
  testMode: boolean,
): number {
  let pages = 1;
  let y = firstContentY(testMode);

  for (const [index, block] of blocks.entries()) {
    const blockHeight = estimateDailyBlockHeight(block);
    if (index > 0) {
      y -= 16;
    }
    if (y - blockHeight < PAGE_MARGIN + 24) {
      pages += 1;
      y = firstContentY(testMode);
    }
    y -= blockHeight;
  }

  return pages;
}

function drawMonthlySheet(
  pdf: PDFDocument,
  options: {
    title: string;
    rows: LibroIvaRow[];
    period: string;
    issuer: InvoicePdfIssuer;
    testMode: boolean;
    font: PDFFont;
    bold: PDFFont;
    pageOffset: number;
    documentPageCount: number;
  },
): void {
  let pageIndex = 1;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawSharedHeader(page, {
    title: "LIBRO IVA VENTAS",
    subtitle: options.title,
    period: options.period,
    pageLabel: `Pagina ${options.pageOffset + pageIndex} de ${options.documentPageCount}`,
    issuer: options.issuer,
    testMode: options.testMode,
    font: options.font,
    bold: options.bold,
  });

  drawTableHeader(page, y, options.bold, MONTHLY_COLUMNS);
  y -= HEADER_HEIGHT;

  if (options.rows.length === 0) {
    drawPdfText(page, "Sin comprobantes en este período.", {
      x: PAGE_MARGIN + 4,
      y: y - 16,
      size: 9,
      font: options.font,
      color: PDF_GRAY,
    });
    drawMonthlyTotals(page, y - 40, sumLibroIvaRows([]), options.bold);
    return;
  }

  for (const [index, row] of options.rows.entries()) {
    if (y < PAGE_MARGIN + 48) {
      pageIndex += 1;
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawSharedHeader(page, {
        title: "LIBRO IVA VENTAS",
        subtitle: options.title,
        period: options.period,
        pageLabel: `Pagina ${options.pageOffset + pageIndex} de ${options.documentPageCount}`,
        issuer: options.issuer,
        testMode: options.testMode,
        font: options.font,
        bold: options.bold,
      });
      drawTableHeader(page, y, options.bold, MONTHLY_COLUMNS);
      y -= HEADER_HEIGHT;
    }

    drawMonthlyRow(page, y, row, index, options.font);
    y -= ROW_HEIGHT;
  }

  if (y < PAGE_MARGIN + 36) {
    pageIndex += 1;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = drawSharedHeader(page, {
      title: "LIBRO IVA VENTAS",
      subtitle: options.title,
      period: options.period,
      pageLabel: `Pagina ${options.pageOffset + pageIndex} de ${options.documentPageCount}`,
      issuer: options.issuer,
      testMode: options.testMode,
      font: options.font,
      bold: options.bold,
    });
  }

  drawMonthlyTotals(page, y - 10, sumLibroIvaRows(options.rows), options.bold);
}

function drawAbSummaryPage(
  pdf: PDFDocument,
  options: {
    summary: LibroIvaAbSummary;
    period: string;
    issuer: InvoicePdfIssuer;
    testMode: boolean;
    font: PDFFont;
    bold: PDFFont;
    pageNumber: number;
    documentPageCount: number;
  },
): void {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawSharedHeader(page, {
    title: "LIBRO IVA VENTAS",
    subtitle: "Facturas A y B",
    period: options.period,
    pageLabel: `Pagina ${options.pageNumber} de ${options.documentPageCount}`,
    issuer: options.issuer,
    testMode: options.testMode,
    font: options.font,
    bold: options.bold,
  });

  y -= 4;
  drawPdfText(page, "Resumen facturas A y B", {
    x: PAGE_MARGIN,
    y,
    size: 10,
    font: options.bold,
    color: PDF_NAVY,
  });
  y -= 16;
  drawTableHeader(page, y, options.bold, AB_SUMMARY_COLUMNS);
  y -= HEADER_HEIGHT;

  for (const row of options.summary.rows) {
    let x = PAGE_MARGIN + 4;
    for (const column of AB_SUMMARY_COLUMNS) {
      if (column.key === "pv") {
        drawPdfText(page, row.pointOfSale, {
          x,
          y: y - 6,
          size: FONT_SIZE,
          font: options.font,
          color: PDF_NAVY,
          maxWidth: column.width - 6,
        });
      } else if (column.key === "letter") {
        drawPdfText(page, row.letter, {
          x,
          y: y - 6,
          size: FONT_SIZE,
          font: options.font,
          color: PDF_NAVY,
          maxWidth: column.width - 6,
        });
      } else if (column.key === "ivaPct") {
        drawPdfText(page, formatPdfQuantity(row.ivaPercent), {
          x,
          y: y - 6,
          size: FONT_SIZE,
          font: options.font,
          color: PDF_NAVY,
          maxWidth: column.width - 6,
        });
      } else if (column.key === "total") {
        drawPdfAmountCell(page, row.total, {
          x,
          y: y - 6,
          width: column.width - 8,
          size: FONT_SIZE,
          font: options.font,
          color: PDF_NAVY,
        });
      } else if (column.key === "neto") {
        drawPdfAmountCell(page, row.netAmount, {
          x,
          y: y - 6,
          width: column.width - 8,
          size: FONT_SIZE,
          font: options.font,
          color: PDF_NAVY,
        });
      } else if (column.key === "ivaAmt") {
        drawPdfAmountCell(page, row.ivaAmount, {
          x,
          y: y - 6,
          width: column.width - 8,
          size: FONT_SIZE,
          font: options.font,
          color: PDF_NAVY,
        });
      }
      x += column.width;
    }
    y -= ROW_HEIGHT;
  }

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 16,
    width: CONTENT_WIDTH,
    height: 20,
    color: PDF_LINE,
  });

  let x = PAGE_MARGIN + 4;
  for (const column of AB_SUMMARY_COLUMNS) {
    if (column.key === "letter") {
      drawPdfText(page, "TOTALES:", {
        x,
        y: y - 9,
        size: 8,
        font: options.bold,
        color: PDF_NAVY,
        maxWidth: column.width - 6,
      });
    } else if (column.key === "total") {
      drawPdfAmountCell(page, options.summary.totals.total, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: options.bold,
        color: PDF_NAVY,
      });
    } else if (column.key === "neto") {
      drawPdfAmountCell(page, options.summary.totals.netAmount, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: options.bold,
        color: PDF_NAVY,
      });
    } else if (column.key === "ivaAmt") {
      drawPdfAmountCell(page, options.summary.totals.ivaAmount, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: options.bold,
        color: PDF_NAVY,
      });
    }
    x += column.width;
  }
}

function drawSharedHeader(
  page: PDFPage,
  options: {
    title: string;
    subtitle: string;
    period: string;
    pageLabel: string;
    issuer: InvoicePdfIssuer;
    testMode: boolean;
    font: PDFFont;
    bold: PDFFont;
  },
): number {
  let y = PAGE_HEIGHT - PAGE_MARGIN;

  if (options.testMode) {
    page.drawText(toWinAnsi(TEST_BANNER), {
      x: 180,
      y: PAGE_HEIGHT / 2,
      size: 18,
      font: options.bold,
      color: rgb(0.75, 0.55, 0.2),
      opacity: 0.12,
      rotate: degrees(18),
    });
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - 18,
      width: CONTENT_WIDTH,
      height: 18,
      color: PDF_AMBER_BG,
    });
    drawPdfText(page, TEST_BANNER, {
      x: PAGE_MARGIN + 8,
      y: y - 13,
      size: 8,
      font: options.bold,
      color: PDF_AMBER,
    });
    y -= 28;
  }

  drawPdfText(page, options.issuer.name, {
    x: PAGE_MARGIN,
    y: y - 2,
    size: 11,
    font: options.bold,
    color: PDF_NAVY,
  });
  const periodWidth = options.bold.widthOfTextAtSize(
    toWinAnsi(options.period),
    11,
  );
  drawPdfText(page, options.period, {
    x: PAGE_WIDTH - PAGE_MARGIN - periodWidth,
    y: y - 2,
    size: 11,
    font: options.bold,
    color: PDF_NAVY,
  });
  y -= 14;
  drawPdfText(page, issuerFiscalLines(options.issuer)[0] ?? "", {
    x: PAGE_MARGIN,
    y,
    size: 8,
    font: options.font,
    color: PDF_GRAY,
  });
  const pageWidth = options.bold.widthOfTextAtSize(
    toWinAnsi(options.pageLabel),
    9,
  );
  drawPdfText(page, options.pageLabel, {
    x: PAGE_WIDTH - PAGE_MARGIN - pageWidth,
    y,
    size: 9,
    font: options.bold,
    color: PDF_NAVY,
  });
  y -= 20;
  drawPdfText(page, options.title, {
    x: PAGE_MARGIN,
    y,
    size: 12,
    font: options.bold,
    color: PDF_NAVY,
  });
  drawPdfText(page, options.subtitle, {
    x: PAGE_MARGIN + 180,
    y,
    size: 11,
    font: options.bold,
    color: PDF_BLUE,
  });
  y -= 12;
  drawPdfText(page, issuerLocationLine(options.issuer), {
    x: PAGE_MARGIN,
    y,
    size: 7,
    font: options.font,
    color: PDF_GRAY,
  });
  y -= 8;
  page.drawRectangle({
    x: PAGE_MARGIN,
    y,
    width: CONTENT_WIDTH,
    height: 1,
    color: PDF_LINE,
  });
  return y - 8;
}

function drawTableHeader(
  page: PDFPage,
  y: number,
  bold: PDFFont,
  columns: readonly { key: string; label: string; width: number }[],
): void {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - HEADER_HEIGHT + 4,
    width: CONTENT_WIDTH,
    height: HEADER_HEIGHT,
    color: PDF_NAVY,
  });

  let x = PAGE_MARGIN + 4;
  for (const column of columns) {
    drawPdfText(page, column.label, {
      x,
      y: y - 9,
      size: FONT_SIZE,
      font: bold,
      color: rgb(1, 1, 1),
      maxWidth: column.width - 6,
    });
    x += column.width;
  }
}

function drawMonthlyRow(
  page: PDFPage,
  y: number,
  row: LibroIvaRow,
  index: number,
  font: PDFFont,
): void {
  if (index % 2 === 1) {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - ROW_HEIGHT + 4,
      width: CONTENT_WIDTH,
      height: ROW_HEIGHT,
      color: PDF_MUTED,
    });
  }

  const color = row.docKind === "NC" ? PDF_GRAY : PDF_NAVY;
  let x = PAGE_MARGIN + 4;
  for (const column of MONTHLY_COLUMNS) {
    if (MONEY_KEYS.has(column.key)) {
      drawPdfAmountCell(
        page,
        moneyValue(row, column.key as "neto" | "ivaAmt" | "total"),
        {
          x,
          y: y - 6,
          width: column.width - 8,
          size: FONT_SIZE,
          font,
          color,
        },
      );
    } else {
      drawPdfText(page, monthlyCellText(row, column.key), {
        x,
        y: y - 6,
        size: FONT_SIZE,
        font,
        color,
        maxWidth: column.width - 6,
      });
    }
    x += column.width;
  }
}

function drawMonthlyTotals(
  page: PDFPage,
  y: number,
  totals: ReturnType<typeof sumLibroIvaRows>,
  bold: PDFFont,
): void {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 16,
    width: CONTENT_WIDTH,
    height: 20,
    color: PDF_MUTED,
  });
  drawPdfText(page, "Total", {
    x: PAGE_MARGIN + 4,
    y: y - 9,
    size: 8,
    font: bold,
    color: PDF_NAVY,
  });

  let x = PAGE_MARGIN + 4;
  for (const column of MONTHLY_COLUMNS) {
    if (column.key === "neto") {
      drawPdfAmountCell(page, totals.netAmount, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: bold,
        color: PDF_NAVY,
      });
    } else if (column.key === "ivaAmt") {
      drawPdfAmountCell(page, totals.ivaAmount, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: bold,
        color: PDF_NAVY,
      });
    } else if (column.key === "total") {
      drawPdfAmountCell(page, totals.total, {
        x,
        y: y - 9,
        width: column.width - 8,
        size: 8,
        font: bold,
        color: PDF_NAVY,
      });
    }
    x += column.width;
  }
}

function drawDailyBlock(
  page: PDFPage,
  startY: number,
  block: LibroIvaDailyBlock,
  font: PDFFont,
  bold: PDFFont,
): number {
  const columns = dailyColumnsForBlock(block);
  let y = startY;
  drawPdfText(page, block.title, {
    x: PAGE_MARGIN,
    y,
    size: 9,
    font: bold,
    color: PDF_BLUE,
  });
  y -= 10;
  drawTableHeader(page, y, bold, columns);
  y -= HEADER_HEIGHT;

  if (block.displayRows.length === 0) {
    drawPdfText(page, "Sin comprobantes.", {
      x: PAGE_MARGIN + 4,
      y: y - 10,
      size: 8,
      font,
      color: PDF_GRAY,
    });
    return y - 28;
  }

  for (const [index, row] of block.displayRows.entries()) {
    let x = PAGE_MARGIN + 4;
    if (index % 2 === 1) {
      page.drawRectangle({
        x: PAGE_MARGIN,
        y: y - ROW_HEIGHT + 4,
        width: CONTENT_WIDTH,
        height: ROW_HEIGHT,
        color: PDF_MUTED,
      });
    }
    for (const column of columns) {
      if (MONEY_KEYS.has(column.key)) {
        drawPdfAmountCell(
          page,
          moneyValue(row, column.key as "neto" | "ivaAmt" | "total"),
          {
            x,
            y: y - 6,
            width: column.width - 8,
            size: FONT_SIZE,
            font,
            color: PDF_NAVY,
          },
        );
      } else {
        drawPdfText(page, dailyCellText(row, column.key), {
          x,
          y: y - 6,
          size: FONT_SIZE,
          font,
          maxWidth: column.width - 6,
        });
      }
      x += column.width;
    }
    y -= ROW_HEIGHT;
  }

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 14,
    width: CONTENT_WIDTH,
    height: 16,
    color: PDF_MUTED,
  });
  drawPdfText(page, "Total", {
    x: PAGE_MARGIN + 4,
    y: y - 8,
    size: 8,
    font: bold,
  });
  let totalsX = PAGE_MARGIN + 4;
  for (const column of columns) {
    if (column.key === "neto") {
      drawPdfAmountCell(page, block.totals.netAmount, {
        x: totalsX,
        y: y - 8,
        width: column.width - 8,
        size: 8,
        font: bold,
      });
    } else if (column.key === "ivaAmt") {
      drawPdfAmountCell(page, block.totals.ivaAmount, {
        x: totalsX,
        y: y - 8,
        width: column.width - 8,
        size: 8,
        font: bold,
      });
    } else if (column.key === "total") {
      drawPdfAmountCell(page, block.totals.total, {
        x: totalsX,
        y: y - 8,
        width: column.width - 8,
        size: 8,
        font: bold,
      });
    }
    totalsX += column.width;
  }

  return y - 24;
}
