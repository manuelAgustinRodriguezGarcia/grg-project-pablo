import { inflateSync } from "node:zlib";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { LibroIvaRow } from "@/features/billing/utils/libro-iva";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";
import { buildLibroIvaXlsx } from "@/server/excel/build-libro-iva-xlsx";
import { buildLibroIvaPdf } from "@/server/pdf/build-libro-iva-pdf";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";

const issuer: InvoicePdfIssuer = {
  name: "ROTHAMEL REPUESTOS",
  cuit: "30712345671",
  address: "Ruta 89",
  city: "Pampa del Infierno",
  province: "Chaco",
  ivaCondition: "Responsable Inscripto",
  grossIncome: "IIBB-123456",
  activitiesStartedAt: "2004-03-15",
};

function row(overrides: Partial<LibroIvaRow>): LibroIvaRow {
  return {
    issuedAt: new Date(2026, 9, 2, 12, 0, 0),
    docKind: "FACTURA",
    letter: "A",
    pointOfSale: "0007",
    number: "0007-00000001",
    clientName: "Cliente",
    identification: "30-71234567-1",
    ivaCondition: "RI",
    ivaPercent: 21,
    netAmount: 1000,
    ivaAmount: 210,
    total: 1210,
    associatedNumber: "",
    ...overrides,
  };
}

const rows: LibroIvaRow[] = [
  row({}),
  row({
    docKind: "NC",
    letter: "A",
    number: "0007-00000004",
    netAmount: -100,
    ivaAmount: -21,
    total: -121,
    associatedNumber: "0007-00000001",
  }),
  row({
    docKind: "ND",
    letter: "B",
    number: "0007-00000005",
    netAmount: 50,
    ivaAmount: 10.5,
    total: 60.5,
    associatedNumber: "0007-00000001",
  }),
];

function pdfText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamAt = buffer.indexOf("stream", cursor);
    if (streamAt < 0) {
      break;
    }
    let dataStart = streamAt + "stream".length;
    if (buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }
    if (buffer[dataStart] === 0x0a) {
      dataStart += 1;
    }
    const end = buffer.indexOf("endstream", dataStart);
    if (end < 0) {
      break;
    }
    let dataEnd = end;
    if (buffer[dataEnd - 1] === 0x0a) {
      dataEnd -= 1;
    }
    if (buffer[dataEnd - 1] === 0x0d) {
      dataEnd -= 1;
    }
    const slice = buffer.subarray(dataStart, dataEnd);
    try {
      parts.push(inflateSync(slice).toString("latin1"));
    } catch {
      parts.push(slice.toString("latin1"));
    }
    cursor = end + "endstream".length;
  }

  const content = parts.join("\n");
  const texts: string[] = [];
  const pattern = /<([0-9A-Fa-f]+)>\s*Tj/g;
  for (const match of content.matchAll(pattern)) {
    texts.push(Buffer.from(match[1] ?? "", "hex").toString("latin1"));
  }
  return texts.join("\n");
}

async function sheetValues(bytes: Uint8Array): Promise<unknown> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  return workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.getSheetValues(),
  }));
}

describe("regresión del generador de Libro de IVA", () => {
  it("repite el contenido fiscal del PDF y del Excel para la misma entrada", async () => {
    const input = {
      year: 2026,
      month: 10,
      rows,
      issuer,
      environment: "PRODUCCION" as const,
      ivaPercent: 21,
      pointOfSale: "0007",
    };
    const firstPdf = await buildLibroIvaPdf(input);
    const secondPdf = await buildLibroIvaPdf(input);
    const firstText = pdfText(firstPdf);
    const secondText = pdfText(secondPdf);

    expect(secondText).toBe(firstText);
    expect(firstText.indexOf("0007-00000001")).toBeGreaterThan(-1);
    expect(firstText.indexOf("0007-00000001")).toBeLessThan(
      firstText.indexOf("0007-00000004"),
    );
    expect(firstText).toContain(formatPdfAmount(1210));
    expect(firstText).toContain(formatPdfAmount(-121));
    expect(firstText).toContain(formatPdfAmount(60.5));
    expect(firstText).toContain(formatPdfAmount(1000));
    expect(firstText).toContain(formatPdfAmount(-100));
    expect(firstText).toContain(formatPdfAmount(50));
    expect(firstText).toContain("NC");
    expect(firstText).toContain("ND");

    const firstXlsx = await buildLibroIvaXlsx(input);
    const secondXlsx = await buildLibroIvaXlsx(input);
    expect(await sheetValues(secondXlsx)).toEqual(await sheetValues(firstXlsx));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(firstXlsx) as unknown as ExcelJS.Buffer);
    const sheetA = workbook.getWorksheet("Facturas A");
    const numbers: string[] = [];
    let creditNet: unknown;
    let creditIva: unknown;
    let creditTotal: unknown;
    sheetA?.eachRow((excelRow) => {
      const value = excelRow.getCell(5).value;
      if (typeof value === "string" && value.startsWith("0007-")) {
        numbers.push(value);
      }
      if (value === "0007-00000004") {
        creditNet = excelRow.getCell(10).value;
        creditIva = excelRow.getCell(11).value;
        creditTotal = excelRow.getCell(12).value;
      }
    });
    expect(numbers).toEqual(["0007-00000001", "0007-00000004"]);
    expect(creditNet).toBe(-100);
    expect(creditIva).toBe(-21);
    expect(creditTotal).toBe(-121);
  });
});
