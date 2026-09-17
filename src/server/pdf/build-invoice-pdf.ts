import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { IVA_CONDITION_LABELS } from "@/features/billing/types/billing-client.types";
import { invoicePdfTipoFacturaLabel } from "@/features/billing/types/billing-invoice.types";
import { formatInvoiceIdentification } from "@/features/billing/utils/invoice-list";
import {
  formatPdfAmount,
  formatPdfQuantity,
} from "@/features/billing/utils/pdf-money";
import {
  computeLineNetCents,
  extractNetCents,
  pesosToCents,
} from "@/shared/utils/billing-invoice-totals";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import {
  drawBillingDocumentHeader,
  embedBillingPdfLogo,
} from "@/server/pdf/billing-pdf-header";
import { comprobanteLetterColor } from "@/server/pdf/comprobante-letter-box";
import {
  issuerFiscalLines,
  issuerIdentityLines,
} from "@/server/pdf/invoice-pdf-issuer";
import type { InvoicePdfInput } from "@/server/pdf/invoice-pdf.types";
import {
  A4_HEIGHT,
  A4_WIDTH,
  PAGE_MARGIN,
  PDF_AMBER,
  PDF_AMBER_BG,
  PDF_BLUE,
  PDF_GRAY,
  PDF_LINE,
  PDF_MUTED,
  PDF_NAVY,
  drawPdfText,
  formatPdfDate,
  joinLocation,
  wrapPdfText,
} from "@/server/pdf/pdf-layout";

const TEST_BANNER = "MODO PRUEBA - NO VALIDO COMO FACTURA FISCAL";
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const ROW_HEIGHT = 16;
const FOOTER_RESERVE = 170;
const CONTINUATION_RESERVE = 40;

type TableColumn = {
  key: "code" | "detail" | "qty" | "unit" | "total";
  label: string;
  width: number;
  align: "left" | "right";
};

const COLUMNS_B: TableColumn[] = [
  { key: "code", label: "Codigo", width: 62, align: "left" },
  { key: "detail", label: "Detalle", width: 248, align: "left" },
  { key: "qty", label: "Cant.", width: 48, align: "right" },
  { key: "unit", label: "P. unitario", width: 90, align: "right" },
  { key: "total", label: "Total", width: 75, align: "right" },
];

const COLUMNS_A: TableColumn[] = [
  { key: "code", label: "Codigo", width: 58, align: "left" },
  { key: "detail", label: "Detalle", width: 210, align: "left" },
  { key: "qty", label: "Cant.", width: 42, align: "right" },
  { key: "unit", label: "P. unitario S/IVA", width: 108, align: "right" },
  { key: "total", label: "Total S/IVA", width: 105, align: "right" },
];

function columnsForInvoice(invoiceType: InvoicePdfInput["invoiceType"]): TableColumn[] {
  return invoiceType === "A" ? COLUMNS_A : COLUMNS_B;
}

function drawWatermark(page: PDFPage, font: PDFFont, testMode: boolean): void {
  if (!testMode) {
    return;
  }

  page.drawText(toWinAnsi(TEST_BANNER), {
    x: 72,
    y: A4_HEIGHT / 2 - 20,
    size: 18,
    font,
    color: rgb(0.75, 0.55, 0.2),
    opacity: 0.16,
    rotate: degrees(32),
  });
}

function drawTestBanner(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  testMode: boolean,
): number {
  if (!testMode) {
    return A4_HEIGHT - PAGE_MARGIN;
  }

  const top = A4_HEIGHT - 22;
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: top - 22,
    width: CONTENT_WIDTH,
    height: 22,
    color: PDF_AMBER_BG,
    borderColor: rgb(0.85, 0.62, 0.22),
    borderWidth: 0.6,
  });
  drawPdfText(page, TEST_BANNER, {
    x: PAGE_MARGIN + 8,
    y: top - 16,
    size: 8,
    font: bold,
    color: PDF_AMBER,
  });

  const caption = "Documento interno. No enviar a ARCA.";
  const captionWidth = font.widthOfTextAtSize(caption, 8);
  drawPdfText(page, caption, {
    x: A4_WIDTH - PAGE_MARGIN - 8 - captionWidth,
    y: top - 16,
    size: 8,
    font,
    color: PDF_AMBER,
  });

  return top - 36;
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  input: InvoicePdfInput,
  logo: PDFImage | null,
  startY: number,
): number {
  const headerBottom = drawBillingDocumentHeader(page, font, bold, {
    startY,
    box: { kind: "FACTURA", letter: input.invoiceType },
    logo,
    title: `FACTURA ${input.invoiceType}`,
    titleColor: comprobanteLetterColor(input.invoiceType),
    documentNumber: input.invoiceNumber,
    dateLine: `Fecha: ${formatPdfDate(input.issuedAt)}`,
    metaLines: [],
    fiscalLines: issuerFiscalLines(input.issuer),
    identityLines: issuerIdentityLines(input.issuer),
  });

  const lineY = headerBottom - 8;
  page.drawLine({
    start: { x: PAGE_MARGIN, y: lineY },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: lineY },
    thickness: 1,
    color: PDF_NAVY,
  });

  return lineY - 14;
}

function drawClientBox(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  input: InvoicePdfInput,
  startY: number,
): number {
  const identification = formatInvoiceIdentification(
    input.clientIdentificationType,
    input.clientIdentificationNumber,
  );
  const lines = [
    input.clientName,
    input.clientAddress,
    joinLocation(input.clientCity, input.clientProvince),
    identification,
    `Condicion IVA: ${IVA_CONDITION_LABELS[input.clientIvaCondition]}`,
    `Codigo cliente: ${input.clientCode}`,
  ].filter((line): line is string => Boolean(line));

  const tipoLabel = `Tipo de factura: ${invoicePdfTipoFacturaLabel(input.paymentMethod)}`;
  const tipoBandHeight = 16;
  const boxHeight = 18 + lines.length * 11 + tipoBandHeight + 4;

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: startY - boxHeight + 8,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: PDF_MUTED,
  });
  drawPdfText(page, "Cliente", {
    x: PAGE_MARGIN + 8,
    y: startY,
    size: 8,
    font: bold,
    color: PDF_BLUE,
  });

  let y = startY - 12;
  for (const line of lines) {
    drawPdfText(page, line, {
      x: PAGE_MARGIN + 8,
      y,
      size: 8,
      font,
      maxWidth: CONTENT_WIDTH - 16,
    });
    y -= 11;
  }

  const tipoTop = y - 2;
  page.drawRectangle({
    x: PAGE_MARGIN + 4,
    y: tipoTop - tipoBandHeight + 4,
    width: CONTENT_WIDTH - 8,
    height: tipoBandHeight,
    color: rgb(0.9, 0.93, 0.97),
    borderColor: rgb(0.72, 0.78, 0.86),
    borderWidth: 0.5,
  });
  drawPdfText(page, tipoLabel, {
    x: PAGE_MARGIN + 10,
    y: tipoTop - 6,
    size: 8,
    font: bold,
    color: PDF_NAVY,
    maxWidth: CONTENT_WIDTH - 24,
  });

  return startY - boxHeight - 10;
}

function drawTableHeader(
  page: PDFPage,
  bold: PDFFont,
  columns: readonly TableColumn[],
  y: number,
): number {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 6,
    width: CONTENT_WIDTH,
    height: 16,
    color: PDF_NAVY,
  });

  let x = PAGE_MARGIN + 6;
  for (const column of columns) {
    const labelWidth = bold.widthOfTextAtSize(column.label, 8);
    const textX =
      column.align === "right" ? x + column.width - 8 - labelWidth : x;
    drawPdfText(page, column.label, {
      x: textX,
      y: y,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    });
    x += column.width;
  }

  return y - 18;
}

function cellValue(
  input: InvoicePdfInput["items"][number],
  key: TableColumn["key"],
  invoice: InvoicePdfInput,
): string {
  switch (key) {
    case "code":
      return input.rubroCode;
    case "detail":
      return input.description;
    case "qty":
      return formatPdfQuantity(input.quantity);
    case "unit": {
      if (invoice.invoiceType === "A") {
        return formatPdfAmount(
          extractNetCents(pesosToCents(input.unitPrice), invoice.ivaPercent) /
            100,
        );
      }
      return formatPdfAmount(input.unitPrice);
    }
    case "total": {
      if (invoice.invoiceType === "A") {
        return formatPdfAmount(
          computeLineNetCents(
            input.quantity,
            pesosToCents(input.unitPrice),
            invoice.ivaPercent,
          ) / 100,
        );
      }
      return formatPdfAmount(input.lineTotal);
    }
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function drawItemRow(
  page: PDFPage,
  font: PDFFont,
  item: InvoicePdfInput["items"][number],
  invoice: InvoicePdfInput,
  columns: readonly TableColumn[],
  y: number,
  zebra: boolean,
): number {
  const detailColumn = columns.find((column) => column.key === "detail");
  const detailWidth = detailColumn?.width ?? 248;
  const detailLines = wrapPdfText(item.description, font, 8, detailWidth - 10);
  const rowHeight = Math.max(ROW_HEIGHT, detailLines.length * 10 + 6);

  if (zebra) {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - rowHeight + 10,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: rgb(0.97, 0.98, 0.99),
    });
  }

  let x = PAGE_MARGIN + 6;
  for (const column of columns) {
    if (column.key === "detail") {
      let lineY = y;
      for (const line of detailLines) {
        drawPdfText(page, line, {
          x,
          y: lineY,
          size: 8,
          font,
          maxWidth: column.width - 8,
        });
        lineY -= 10;
      }
    } else {
      const value = cellValue(item, column.key, invoice);
      const valueWidth = font.widthOfTextAtSize(toWinAnsi(value), 8);
      const textX =
        column.align === "right" ? x + column.width - 8 - valueWidth : x;
      drawPdfText(page, value, {
        x: textX,
        y,
        size: 8,
        font,
        maxWidth: column.width - 8,
      });
    }
    x += column.width;
  }

  page.drawLine({
    start: { x: PAGE_MARGIN, y: y - rowHeight + 10 },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: y - rowHeight + 10 },
    thickness: 0.4,
    color: PDF_LINE,
  });

  return y - rowHeight;
}

function drawTotals(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  input: InvoicePdfInput,
  y: number,
): number {
  const rows: Array<{ label: string; value: string; emphasize?: boolean }> = [
    {
      label: input.invoiceType === "A" ? "Subtotal neto s/IVA" : "Subtotal",
      value: `$ ${formatPdfAmount(input.subtotal)}`,
    },
  ];

  if (input.discountAmount > 0) {
    rows.push({
      label: `Descuento (${formatPdfQuantity(input.discountPercent)}%)`,
      value: `- $ ${formatPdfAmount(input.discountAmount)}`,
    });
    rows.push({
      label: "Subtotal neto",
      value: `$ ${formatPdfAmount(input.subtotal - input.discountAmount)}`,
    });
  }

  if (input.invoiceType === "A") {
    rows.push({
      label: `IVA ${formatPdfQuantity(input.ivaPercent)}%`,
      value: `$ ${formatPdfAmount(input.ivaAmount)}`,
    });
  }

  rows.push({
    label: "Total",
    value: `$ ${formatPdfAmount(input.totalVisualRounded)}`,
    emphasize: true,
  });

  let cursor = y;
  const boxWidth = 220;
  const boxX = A4_WIDTH - PAGE_MARGIN - boxWidth;

  for (const row of rows) {
    const fontFace = row.emphasize ? bold : font;
    drawPdfText(page, row.label, {
      x: boxX,
      y: cursor,
      size: row.emphasize ? 10 : 8,
      font: fontFace,
    });
    const valueWidth = fontFace.widthOfTextAtSize(
      toWinAnsi(row.value),
      row.emphasize ? 10 : 8,
    );
    drawPdfText(page, row.value, {
      x: boxX + boxWidth - valueWidth,
      y: cursor,
      size: row.emphasize ? 10 : 8,
      font: fontFace,
    });
    cursor -= row.emphasize ? 16 : 13;
  }

  if (input.notes?.trim()) {
    cursor -= 8;
    drawPdfText(page, "Observaciones", {
      x: PAGE_MARGIN,
      y: cursor,
      size: 8,
      font: bold,
      color: PDF_GRAY,
    });
    cursor -= 12;
    const noteLines = wrapPdfText(input.notes.trim(), font, 8, CONTENT_WIDTH);
    for (const line of noteLines.slice(0, 4)) {
      drawPdfText(page, line, {
        x: PAGE_MARGIN,
        y: cursor,
        size: 8,
        font,
        color: PDF_GRAY,
      });
      cursor -= 11;
    }
  }

  cursor -= 10;
  drawPdfText(
    page,
    input.environment === "MODO_PRUEBA"
      ? "Sin CAE ni QR fiscal. Este comprobante no tiene validez ante ARCA."
      : "Documento generado por Rothamel Repuestos.",
    {
      x: PAGE_MARGIN,
      y: cursor,
      size: 7,
      font,
      color: PDF_GRAY,
    },
  );

  return cursor;
}

export async function buildInvoicePdf(
  input: InvoicePdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedBillingPdfLogo(pdf, input.logoPng);
  const testMode = input.environment === "MODO_PRUEBA";
  const columns = columnsForInvoice(input.invoiceType);
  const detailWidth =
    columns.find((column) => column.key === "detail")?.width ?? 248;

  const addPage = (): PDFPage => {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    drawWatermark(page, bold, testMode);
    return page;
  };

  const startContentPage = (target: PDFPage): number => {
    let y = drawTestBanner(target, font, bold, testMode);
    y = drawHeader(target, font, bold, input, logo, y);
    y = drawClientBox(target, font, bold, input, y);
    return drawTableHeader(target, bold, columns, y);
  };

  let page = addPage();
  let y = startContentPage(page);

  input.items.forEach((item, index) => {
    const previewLines = wrapPdfText(
      item.description,
      font,
      8,
      detailWidth - 10,
    );
    const needed = Math.max(ROW_HEIGHT, previewLines.length * 10 + 6);

    if (y - needed < PAGE_MARGIN + CONTINUATION_RESERVE) {
      page = addPage();
      y = startContentPage(page);
    }

    y = drawItemRow(page, font, item, input, columns, y, index % 2 === 1);
  });

  if (y < PAGE_MARGIN + FOOTER_RESERVE) {
    page = addPage();
    y = startContentPage(page);
  }

  drawTotals(page, font, bold, input, y - 18);

  return pdf.save();
}
