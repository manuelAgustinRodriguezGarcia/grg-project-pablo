import ExcelJS from "exceljs";
import {
  buildLibroIvaAbSummary,
  buildLibroIvaDailyBlocks,
  buildLibroIvaZSimpleSections,
  libroIvaDocKindLabel,
  libroIvaRowsForLetter,
  sumLibroIvaRows,
  type LibroIvaDailyReportVariant,
  type LibroIvaRow,
} from "@/features/billing/utils/libro-iva";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";

function periodLabel(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return label.toLocaleUpperCase("es-AR");
}

function dayLabel(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function writeMonthlySheet(
  workbook: ExcelJS.Workbook,
  letter: "A" | "B",
  rows: LibroIvaRow[],
  period: string,
  issuerName: string,
): void {
  const sheet = workbook.addWorksheet(`Facturas ${letter}`, {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  sheet.addRow(["LIBRO IVA VENTAS"]);
  sheet.addRow([`FACTURAS ${letter}`]);
  sheet.addRow([`PERIODO: ${period}`]);
  sheet.addRow([issuerName]);
  sheet.addRow([]);
  sheet.addRow([
    "Fecha",
    "Tipo",
    "Letra",
    "PV",
    "Numero",
    "Cliente",
    "CUIT/DNI",
    "Cond. IVA",
    "IVA %",
    "NETO S/IVA",
    "VALOR DE IVA",
    "Total",
    "Asociado",
  ]);

  for (const row of rows) {
    sheet.addRow([
      row.issuedAt,
      libroIvaDocKindLabel(row.docKind),
      row.letter,
      row.pointOfSale,
      row.number,
      row.clientName,
      row.identification,
      row.ivaCondition,
      row.ivaPercent,
      row.netAmount,
      row.ivaAmount,
      row.total,
      row.associatedNumber || "",
    ]);
  }

  const totals = sumLibroIvaRows(rows);
  sheet.addRow([]);
  sheet.addRow([
    "Total",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    totals.netAmount,
    totals.ivaAmount,
    totals.total,
    "",
  ]);

  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  sheet.getColumn(9).numFmt = "0.00";
  sheet.getColumn(10).numFmt = "#,##0.00";
  sheet.getColumn(11).numFmt = "#,##0.00";
  sheet.getColumn(12).numFmt = "#,##0.00";
  sheet.columns.forEach((column) => {
    column.width = 16;
  });
}

export async function buildLibroIvaXlsx(input: {
  year: number;
  month: number;
  rows: LibroIvaRow[];
  issuer: InvoicePdfIssuer;
  ivaPercent: number;
  pointOfSale: string;
  periodText?: string;
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const period =
    input.periodText ?? periodLabel(input.year, input.month).toLocaleUpperCase("es-AR");
  writeMonthlySheet(
    workbook,
    "A",
    libroIvaRowsForLetter(input.rows, "A"),
    period,
    input.issuer.name,
  );
  writeMonthlySheet(
    workbook,
    "B",
    libroIvaRowsForLetter(input.rows, "B"),
    period,
    input.issuer.name,
  );

  const summary = buildLibroIvaAbSummary(input.rows, {
    pointOfSale: input.pointOfSale,
    ivaPercent: input.ivaPercent,
  });
  const summarySheet = workbook.addWorksheet("Resumen A y B");
  summarySheet.addRow(["Resumen facturas A y B"]);
  summarySheet.addRow([]);
  summarySheet.addRow([
    "PTO. VENTA",
    "FACTURAS",
    "IMPORTE TOTAL",
    "% IVA",
    "IMPORTE S/IVA",
    "VALOR DE IVA",
  ]);
  for (const row of summary.rows) {
    summarySheet.addRow([
      row.pointOfSale,
      row.letter,
      row.total,
      row.ivaPercent,
      row.netAmount,
      row.ivaAmount,
    ]);
  }
  summarySheet.addRow([
    "",
    "TOTALES:",
    summary.totals.total,
    "",
    summary.totals.netAmount,
    summary.totals.ivaAmount,
  ]);
  summarySheet.getColumn(3).numFmt = "#,##0.00";
  summarySheet.getColumn(4).numFmt = "0.00";
  summarySheet.getColumn(5).numFmt = "#,##0.00";
  summarySheet.getColumn(6).numFmt = "#,##0.00";
  summarySheet.columns.forEach((column) => {
    column.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export async function buildLibroIvaDailyXlsx(input: {
  year: number;
  month: number;
  day: number;
  rows: LibroIvaRow[];
  issuer: InvoicePdfIssuer;
  variant?: LibroIvaDailyReportVariant;
}): Promise<Uint8Array> {
  const variant = input.variant ?? "simple";
  if (variant === "detailed") {
    return buildLibroIvaDailyDetailedXlsx(input);
  }
  return buildLibroIvaDailySimpleXlsx(input);
}

async function buildLibroIvaDailyDetailedXlsx(input: {
  year: number;
  month: number;
  day: number;
  rows: LibroIvaRow[];
  issuer: InvoicePdfIssuer;
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Libro IVA diario");
  sheet.addRow(["LIBRO IVA DIARIO"]);
  sheet.addRow([
    `PERIODO: ${dayLabel(input.year, input.month, input.day).toLocaleUpperCase("es-AR")}`,
  ]);
  sheet.addRow([input.issuer.name]);
  sheet.addRow(["Informe Z detallado"]);
  sheet.addRow([]);

  for (const block of buildLibroIvaDailyBlocks(input.rows)) {
    sheet.addRow([block.title]);
    if (block.showLetterColumn) {
      sheet.addRow([
        "Letra",
        "PV",
        "Numero",
        "Cliente",
        "CUIT/DNI",
        "Cond. IVA",
        "IVA %",
        "NETO S/IVA",
        "VALOR DE IVA",
        "Total",
      ]);
      for (const row of block.displayRows) {
        sheet.addRow([
          row.letter,
          row.pointOfSale,
          row.number,
          row.clientName,
          row.identification,
          row.ivaCondition,
          row.ivaPercent,
          row.netAmount,
          row.ivaAmount,
          row.total,
        ]);
      }
      if (block.displayRows.length === 0) {
        sheet.addRow(["Sin comprobantes"]);
      }
      sheet.addRow([
        "Total",
        "",
        "",
        "",
        "",
        "",
        "",
        block.totals.netAmount,
        block.totals.ivaAmount,
        block.totals.total,
      ]);
    } else {
      sheet.addRow([
        "PV",
        "Numero",
        "Cliente",
        "CUIT/DNI",
        "Cond. IVA",
        "IVA %",
        "NETO S/IVA",
        "VALOR DE IVA",
        "Total",
      ]);
      for (const row of block.displayRows) {
        sheet.addRow([
          row.pointOfSale,
          row.number,
          row.clientName,
          row.identification,
          row.ivaCondition,
          row.ivaPercent,
          row.netAmount,
          row.ivaAmount,
          row.total,
        ]);
      }
      if (block.displayRows.length === 0) {
        sheet.addRow(["Sin comprobantes"]);
      }
      sheet.addRow([
        "Total",
        "",
        "",
        "",
        "",
        "",
        block.totals.netAmount,
        block.totals.ivaAmount,
        block.totals.total,
      ]);
    }
    sheet.addRow([]);
  }

  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

async function buildLibroIvaDailySimpleXlsx(input: {
  year: number;
  month: number;
  day: number;
  rows: LibroIvaRow[];
  issuer: InvoicePdfIssuer;
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Informe Z simple");
  sheet.addRow(["LIBRO IVA DIARIO"]);
  sheet.addRow([
    `PERIODO: ${dayLabel(input.year, input.month, input.day).toLocaleUpperCase("es-AR")}`,
  ]);
  sheet.addRow([input.issuer.name]);
  sheet.addRow(["Informe Z simple"]);
  sheet.addRow([]);

  for (const section of buildLibroIvaZSimpleSections(input.rows)) {
    sheet.addRow([section.title]);
    sheet.addRow([
      "Tipo",
      "N° Desde",
      "N° Hasta",
      "IVA %",
      "Neto S/IVA",
      "IVA",
      "TOTAL",
    ]);
    for (const row of section.rows) {
      sheet.addRow([
        row.tipo,
        row.numberFrom,
        row.numberTo,
        row.ivaPercent,
        row.netAmount,
        row.ivaAmount,
        row.total,
      ]);
    }
    if (section.rows.length === 0) {
      sheet.addRow(["Sin comprobantes"]);
    }
    sheet.addRow([
      "Total",
      "",
      "",
      "",
      section.totals.netAmount,
      section.totals.ivaAmount,
      section.totals.total,
    ]);
    sheet.addRow([]);
  }

  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
