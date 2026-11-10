import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { LibroIvaRow } from "@/features/billing/utils/libro-iva";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";
import { PAGE_MARGIN } from "@/server/pdf/pdf-layout";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";
import {
  buildLibroIvaDailyPdf,
  buildLibroIvaPdf,
  layoutDailyLetterLibroIvaColumns,
  layoutDailyLibroIvaColumns,
  layoutMonthlyLibroIvaColumns,
} from "@/server/pdf/build-libro-iva-pdf";

const FONT_SIZE = 7;
const CELL_TEXT_INSET = 6;
const FISCAL_SAMPLE = "9999-99999999";
const PRODUCTION_NUMBER = "0007-00000264";
const TEST_INVOICE_NUMBER = "0007-PRUEBA-000000001";
const TEST_NOTE_NUMBER = "0007-PRUEBA-NC-000000001";
const WIDE_TEST_NOTE_NUMBER = "00007-PRUEBA-NC-000000001";
const TEXT_ORIGIN = PAGE_MARGIN + 4;
const SAMPLE_DIR = path.join(process.cwd(), "tmp", "libro-iva-column-check");

const MONTHLY_BEFORE_NUMERO = 46 + 34 + 26 + 28;
const MONTHLY_NUMERO = 96;
const MONTHLY_CLIENTE = 74;
const MONTHLY_PAIR = MONTHLY_NUMERO + MONTHLY_CLIENTE;
const MONTHLY_ID_X = TEXT_ORIGIN + MONTHLY_BEFORE_NUMERO + MONTHLY_PAIR;
const MONTHLY_NETO_X = MONTHLY_ID_X + 66 + 42 + 34;

const DAILY_NUMERO = 118;
const DAILY_CLIENTE = 102;
const DAILY_PAIR = DAILY_NUMERO + DAILY_CLIENTE;
const DAILY_NUMBER_X = TEXT_ORIGIN + 36;
const DAILY_ID_X = TEXT_ORIGIN + DAILY_PAIR + 36;
const DAILY_NETO_X = DAILY_ID_X + 80 + 62 + 40;

const LETTER_NUMERO = 108;
const LETTER_CLIENTE = 94;
const LETTER_PAIR = LETTER_NUMERO + LETTER_CLIENTE;
const LETTER_NUMBER_X = TEXT_ORIGIN + 32 + 32;
const LETTER_ID_X = TEXT_ORIGIN + 32 + 32 + LETTER_PAIR;
const LETTER_NETO_X = LETTER_ID_X + 76 + 58 + 36;

const Z_SIMPLE_FROM_X = TEXT_ORIGIN + 112;
const Z_SIMPLE_TO_X = Z_SIMPLE_FROM_X + 104;

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

type PlacedText = {
  text: string;
  x: number;
  y: number;
};

function row(overrides: Partial<LibroIvaRow> = {}): LibroIvaRow {
  return {
    issuedAt: new Date(2026, 9, 3, 12, 0, 0),
    docKind: "FACTURA",
    letter: "A",
    pointOfSale: "0007",
    number: PRODUCTION_NUMBER,
    clientName: "ROTHAMEL AUTOS",
    identification: "20-30445566-7",
    ivaCondition: "RI",
    ivaPercent: 21,
    netAmount: 1000,
    ivaAmount: 210,
    total: 1210,
    associatedNumber: "",
    ...overrides,
  };
}

function columnWidth(
  columns: readonly { key: string; width: number }[],
  key: string,
): number {
  const column = columns.find((item) => item.key === key);
  if (!column) {
    throw new Error(`Falta la columna ${key}.`);
  }
  return column.width;
}

function governingTextWidth(font: PDFFont, numbers: readonly string[]): number {
  let textWidth = font.widthOfTextAtSize(FISCAL_SAMPLE, FONT_SIZE);
  for (const number of numbers) {
    textWidth = Math.max(textWidth, font.widthOfTextAtSize(number, FONT_SIZE));
  }
  return textWidth;
}

function expectTightNumero(
  font: PDFFont,
  numbers: readonly string[],
  numeroWidth: number,
) {
  const textWidth = governingTextWidth(font, numbers);
  expect(numeroWidth - CELL_TEXT_INSET).toBeGreaterThanOrEqual(textWidth);
  expect(numeroWidth - CELL_TEXT_INSET).toBeLessThan(textWidth + 1);
}

function expectUntouchedMonthlyColumns(
  columns: readonly { key: string; width: number }[],
) {
  expect(columnWidth(columns, "fecha")).toBe(46);
  expect(columnWidth(columns, "tipo")).toBe(34);
  expect(columnWidth(columns, "letra")).toBe(26);
  expect(columnWidth(columns, "pv")).toBe(28);
  expect(columnWidth(columns, "id")).toBe(66);
  expect(columnWidth(columns, "iva")).toBe(42);
  expect(columnWidth(columns, "ivaPct")).toBe(34);
  expect(columnWidth(columns, "neto")).toBe(86);
  expect(columnWidth(columns, "ivaAmt")).toBe(86);
  expect(columnWidth(columns, "total")).toBe(82);
  expect(columnWidth(columns, "asociado")).toBe(52);
}

function pdfStreams(bytes: Uint8Array): string {
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

  return parts.join("\n");
}

function pdfText(bytes: Uint8Array): string {
  return pdfTextItems(bytes)
    .map((item) => item.text)
    .join("\n");
}

function pdfTextItems(bytes: Uint8Array): PlacedText[] {
  const content = pdfStreams(bytes);
  const items: PlacedText[] = [];
  const pattern =
    /1(?:\.0+)? 0(?:\.0+)? 0(?:\.0+)? 1(?:\.0+)? ([0-9]+(?:\.[0-9]+)?) ([0-9]+(?:\.[0-9]+)?) Tm\s*<([0-9A-Fa-f]+)>\s*Tj/g;

  for (const match of content.matchAll(pattern)) {
    const hex = match[3] ?? "";
    items.push({
      x: Number(match[1]),
      y: Number(match[2]),
      text: Buffer.from(hex, "hex").toString("latin1"),
    });
  }

  return items;
}

function itemsAt(
  items: readonly PlacedText[],
  text: string,
  x: number,
): PlacedText[] {
  return items.filter(
    (item) => item.text === text && Math.abs(item.x - x) < 0.2,
  );
}

function sameRow(
  items: readonly PlacedText[],
  text: string,
  y: number,
): PlacedText | undefined {
  return items.find(
    (item) => item.text === text && Math.abs(item.y - y) < 0.2,
  );
}

function writeSample(name: string, bytes: Uint8Array) {
  mkdirSync(SAMPLE_DIR, { recursive: true });
  writeFileSync(path.join(SAMPLE_DIR, name), bytes);
}

function clientNameForWiderColumn(font: PDFFont, clienteWidth: number): string {
  const oldUsable = MONTHLY_CLIENTE - CELL_TEXT_INSET;
  const usable = clienteWidth - CELL_TEXT_INSET;
  let name = "DISTRIBUIDORA";

  while (font.widthOfTextAtSize(`${name} DEL`, FONT_SIZE) <= oldUsable) {
    name = `${name} DEL`;
  }
  while (font.widthOfTextAtSize(`${name} NORTE`, FONT_SIZE) <= usable) {
    name = `${name} NORTE`;
  }

  return name;
}

async function embeddedFont(): Promise<PDFFont> {
  const pdf = await PDFDocument.create();
  return pdf.embedFont(StandardFonts.Helvetica);
}

describe("columnas Numero y Cliente del libro IVA", () => {
  it("en producción reduce Numero al piso fiscal y se lo pasa a Cliente", async () => {
    const font = await embeddedFont();
    const numbers = [PRODUCTION_NUMBER, "0007-00000003"];
    const monthly = layoutMonthlyLibroIvaColumns(font, numbers);
    const daily = layoutDailyLibroIvaColumns(font, numbers);
    const letter = layoutDailyLetterLibroIvaColumns(font, numbers);

    for (const [columns, previousNumero, previousCliente, pair] of [
      [monthly, MONTHLY_NUMERO, MONTHLY_CLIENTE, MONTHLY_PAIR],
      [daily, DAILY_NUMERO, DAILY_CLIENTE, DAILY_PAIR],
      [letter, LETTER_NUMERO, LETTER_CLIENTE, LETTER_PAIR],
    ] as const) {
      const numero = columnWidth(columns, "numero");
      const cliente = columnWidth(columns, "cliente");
      expectTightNumero(font, numbers, numero);
      expect(numero).toBeLessThan(previousNumero);
      expect(cliente).toBe(pair - numero);
      expect(cliente).toBeGreaterThan(previousCliente);
    }

    expectUntouchedMonthlyColumns(monthly);
    expect(columnWidth(daily, "pv")).toBe(36);
    expect(columnWidth(daily, "id")).toBe(80);
    expect(columnWidth(daily, "neto")).toBe(104);
    expect(columnWidth(daily, "total")).toBe(100);
    expect(columnWidth(letter, "letra")).toBe(32);
    expect(columnWidth(letter, "pv")).toBe(32);
    expect(columnWidth(letter, "id")).toBe(76);
    expect(columnWidth(letter, "total")).toBe(96);
    expect(columnWidth(monthly, "numero")).toBe(columnWidth(daily, "numero"));
    expect(columnWidth(daily, "numero")).toBe(columnWidth(letter, "numero"));
  });

  it("un libro vacío conserva el piso fiscal y no achica Numero de más", async () => {
    const font = await embeddedFont();
    const empty = layoutMonthlyLibroIvaColumns(font, []);
    const short = layoutMonthlyLibroIvaColumns(font, ["1"]);
    const fiscal = layoutMonthlyLibroIvaColumns(font, [FISCAL_SAMPLE]);

    expect(columnWidth(empty, "numero")).toBe(columnWidth(fiscal, "numero"));
    expect(columnWidth(short, "numero")).toBe(columnWidth(fiscal, "numero"));
    expect(columnWidth(empty, "cliente")).toBeGreaterThan(MONTHLY_CLIENTE);
  });

  it("la numeración de prueba entra completa y solo ocupa el ancho que necesita", async () => {
    const font = await embeddedFont();
    const monthly = layoutMonthlyLibroIvaColumns(font, [
      TEST_INVOICE_NUMBER,
      TEST_NOTE_NUMBER,
    ]);
    const daily = layoutDailyLibroIvaColumns(font, [TEST_INVOICE_NUMBER]);
    const letter = layoutDailyLetterLibroIvaColumns(font, [
      TEST_NOTE_NUMBER,
      WIDE_TEST_NOTE_NUMBER,
    ]);
    const monthlyNumero = columnWidth(monthly, "numero");
    const dailyNumero = columnWidth(daily, "numero");
    const letterNumero = columnWidth(letter, "numero");

    expectTightNumero(
      font,
      [TEST_INVOICE_NUMBER, TEST_NOTE_NUMBER],
      monthlyNumero,
    );
    expectTightNumero(font, [TEST_INVOICE_NUMBER], dailyNumero);
    expectTightNumero(
      font,
      [TEST_NOTE_NUMBER, WIDE_TEST_NOTE_NUMBER],
      letterNumero,
    );
    expect(monthlyNumero).toBeGreaterThan(MONTHLY_NUMERO);
    expect(columnWidth(monthly, "cliente")).toBe(MONTHLY_PAIR - monthlyNumero);
    expect(columnWidth(monthly, "cliente")).toBeGreaterThan(0);
    expect(dailyNumero).toBeLessThan(DAILY_NUMERO);
    expect(columnWidth(daily, "cliente")).toBeGreaterThan(DAILY_CLIENTE);
    expect(letterNumero).toBeLessThan(LETTER_NUMERO);
    expect(columnWidth(letter, "cliente")).toBeGreaterThan(LETTER_CLIENTE);
    expect(dailyNumero).toBeLessThan(letterNumero);
    expectUntouchedMonthlyColumns(monthly);
  });

  it("el PDF mensual de producción muestra el número completo y más cliente", async () => {
    const font = await embeddedFont();
    const columns = layoutMonthlyLibroIvaColumns(font, [PRODUCTION_NUMBER]);
    const numeroWidth = columnWidth(columns, "numero");
    const clientName = clientNameForWiderColumn(
      font,
      columnWidth(columns, "cliente"),
    );
    expect(font.widthOfTextAtSize(clientName, FONT_SIZE)).toBeGreaterThan(
      MONTHLY_CLIENTE - CELL_TEXT_INSET,
    );

    const bytes = await buildLibroIvaPdf({
      year: 2026,
      month: 10,
      rows: [
        row({ clientName, number: PRODUCTION_NUMBER }),
        row({
          docKind: "NC",
          number: "0007-00000012",
          clientName,
          netAmount: -200,
          ivaAmount: -42,
          total: -242,
          associatedNumber: PRODUCTION_NUMBER,
        }),
      ],
      issuer,
      environment: "PRODUCCION",
      ivaPercent: 21,
      pointOfSale: "0007",
    });
    writeSample("mensual-produccion.pdf", bytes);
    const items = pdfTextItems(bytes);
    const numberX = TEXT_ORIGIN + MONTHLY_BEFORE_NUMERO;

    expect(itemsAt(items, PRODUCTION_NUMBER, numberX)).toHaveLength(1);
    expect(itemsAt(items, "0007-00000012", numberX)).toHaveLength(1);
    expect(itemsAt(items, clientName, numberX + numeroWidth).length).toBeGreaterThan(
      0,
    );
    expect(itemsAt(items, "Numero", numberX).length).toBeGreaterThan(0);
    expect(itemsAt(items, "Cliente", numberX + numeroWidth).length).toBeGreaterThan(
      0,
    );
    expect(itemsAt(items, "CUIT/DNI", MONTHLY_ID_X).length).toBeGreaterThan(0);
    expect(itemsAt(items, "NETO S/IVA", MONTHLY_NETO_X).length).toBeGreaterThan(0);
    const text = pdfText(bytes);
    expect(text).toContain(formatPdfAmount(1210));
    expect(text).toContain(formatPdfAmount(1000 - 200));
    expect(text).toContain(formatPdfAmount(210 - 42));
    expect(text).toContain("Facturas A");
    expect(text).toContain(PRODUCTION_NUMBER);
    expect(text).toContain("0007-00000012");
  });

  it("el rango personalizado usa la misma tabla mensual", async () => {
    const period = "3 oct 2026 - 9 nov 2026";
    const bytes = await buildLibroIvaPdf({
      year: 2026,
      month: 10,
      periodText: period,
      rows: [row()],
      issuer,
      environment: "PRODUCCION",
      ivaPercent: 21,
      pointOfSale: "0007",
    });
    writeSample("rango-produccion.pdf", bytes);
    const items = pdfTextItems(bytes);
    const numberX = TEXT_ORIGIN + MONTHLY_BEFORE_NUMERO;

    const text = pdfText(bytes);
    expect(text).toContain(period);
    expect(itemsAt(items, PRODUCTION_NUMBER, numberX)).toHaveLength(1);
    expect(itemsAt(items, "CUIT/DNI", MONTHLY_ID_X).length).toBeGreaterThan(0);
    expect(text).toContain(formatPdfAmount(1210));

    const font = await embeddedFont();
    const testBytes = await buildLibroIvaPdf({
      year: 2026,
      month: 10,
      periodText: period,
      rows: [row({ number: TEST_NOTE_NUMBER, clientName: "CLIENTE PRUEBA" })],
      issuer,
      environment: "MODO_PRUEBA",
      ivaPercent: 21,
      pointOfSale: "0007",
    });
    writeSample("rango-prueba.pdf", testBytes);
    const testItems = pdfTextItems(testBytes);
    const testNumero = columnWidth(
      layoutMonthlyLibroIvaColumns(font, [TEST_NOTE_NUMBER]),
      "numero",
    );

    expect(pdfText(testBytes)).toContain(period);
    expect(pdfText(testBytes)).toContain(TEST_NOTE_NUMBER);
    expect(itemsAt(testItems, TEST_NOTE_NUMBER, numberX)).toHaveLength(1);
    expect(itemsAt(testItems, "CLIENTE PRUEBA", numberX + testNumero)).toHaveLength(
      1,
    );
    expect(itemsAt(testItems, "CUIT/DNI", MONTHLY_ID_X).length).toBeGreaterThan(0);
  });

  it("el mensual de prueba pagina y no trunca el número largo", async () => {
    const font = await embeddedFont();
    const rows = Array.from({ length: 40 }, (_, index) =>
      row({
        number: index % 5 === 0 ? TEST_NOTE_NUMBER : TEST_INVOICE_NUMBER,
        clientName: "CLIENTE PRUEBA",
        issuedAt: new Date(2026, 9, 1 + (index % 28), 12, 0, 0),
      }),
    );
    const columns = layoutMonthlyLibroIvaColumns(
      font,
      rows.map((item) => item.number),
    );
    const numberX = TEXT_ORIGIN + MONTHLY_BEFORE_NUMERO;
    const clientX = numberX + columnWidth(columns, "numero");
    const bytes = await buildLibroIvaPdf({
      year: 2026,
      month: 10,
      rows,
      issuer,
      environment: "MODO_PRUEBA",
      ivaPercent: 21,
      pointOfSale: "0007",
    });
    writeSample("mensual-prueba.pdf", bytes);
    const items = pdfTextItems(bytes);
    const noteItems = itemsAt(items, TEST_NOTE_NUMBER, numberX);
    const invoiceItems = itemsAt(items, TEST_INVOICE_NUMBER, numberX);

    expect(noteItems).toHaveLength(8);
    expect(invoiceItems).toHaveLength(32);
    expect(new Set(noteItems.map((item) => item.y)).size).toBeGreaterThan(1);
    expect(itemsAt(items, "CLIENTE PRUEBA", clientX).length).toBe(40);
    expect(itemsAt(items, "CUIT/DNI", MONTHLY_ID_X).length).toBeGreaterThan(0);
    const text = pdfText(bytes);
    expect(text).toContain("MODO PRUEBA - NO VALIDO COMO LIBRO IVA FISCAL");
    expect(text).toContain("Pagina 2 de");
    expect(text).toContain(formatPdfAmount(40 * 1210));
    expect(text).toContain(formatPdfAmount(40 * 1000));
    expect(text).toContain(formatPdfAmount(40 * 210));
    expect(text).toContain(TEST_NOTE_NUMBER);
    expect(text).not.toContain(`${TEST_NOTE_NUMBER.slice(0, 12)}...`);
  });

  it("el informe Z detallado separa la tabla con letra y conserva los importes", async () => {
    const font = await embeddedFont();
    const invoice = row({ clientName: "CLIENTE DIARIO" });
    const note = row({
      docKind: "NC",
      number: "0007-00000012",
      clientName: "CLIENTE NOTA",
      netAmount: -200,
      ivaAmount: -42,
      total: -242,
      associatedNumber: PRODUCTION_NUMBER,
    });
    const standard = layoutDailyLibroIvaColumns(font, [invoice.number]);
    const letter = layoutDailyLetterLibroIvaColumns(font, [note.number]);
    const bytes = await buildLibroIvaDailyPdf({
      year: 2026,
      month: 10,
      day: 3,
      rows: [invoice, note],
      issuer,
      environment: "PRODUCCION",
      variant: "detailed",
    });
    writeSample("z-detallado-produccion.pdf", bytes);
    const items = pdfTextItems(bytes);

    expect(itemsAt(items, PRODUCTION_NUMBER, DAILY_NUMBER_X)).toHaveLength(1);
    expect(
      itemsAt(
        items,
        "CLIENTE DIARIO",
        DAILY_NUMBER_X + columnWidth(standard, "numero"),
      ),
    ).toHaveLength(1);
    expect(itemsAt(items, "0007-00000012", LETTER_NUMBER_X)).toHaveLength(1);
    expect(
      itemsAt(
        items,
        "CLIENTE NOTA",
        LETTER_NUMBER_X + columnWidth(letter, "numero"),
      ),
    ).toHaveLength(1);
    expect(itemsAt(items, "CUIT/DNI", DAILY_ID_X).length).toBeGreaterThan(0);
    expect(itemsAt(items, "CUIT/DNI", LETTER_ID_X).length).toBeGreaterThan(0);
    expect(itemsAt(items, "NETO S/IVA", DAILY_NETO_X).length).toBeGreaterThan(0);
    expect(itemsAt(items, "NETO S/IVA", LETTER_NETO_X).length).toBeGreaterThan(0);
    expect(itemsAt(items, "Letra", TEXT_ORIGIN).length).toBeGreaterThan(0);
    const text = pdfText(bytes);
    expect(text).toContain("Informe Z detallado");
    expect(text).toContain("Notas de crédito");
    expect(text).toContain(formatPdfAmount(1210));
    expect(text).toContain(formatPdfAmount(-242));
    expect(text).not.toContain("...");
  });

  it("el Z detallado de prueba muestra la nota larga sin recortar Cliente de producción", async () => {
    const font = await embeddedFont();
    const invoice = row({
      number: TEST_INVOICE_NUMBER,
      clientName: "CLIENTE DIARIO",
    });
    const note = row({
      docKind: "NC",
      number: TEST_NOTE_NUMBER,
      clientName: "CLIENTE NOTA",
      letter: "B",
    });
    const standard = layoutDailyLibroIvaColumns(font, [invoice.number]);
    const letter = layoutDailyLetterLibroIvaColumns(font, [note.number]);
    const bytes = await buildLibroIvaDailyPdf({
      year: 2026,
      month: 10,
      day: 3,
      rows: [invoice, note],
      issuer,
      environment: "MODO_PRUEBA",
      variant: "detailed",
    });
    writeSample("z-detallado-prueba.pdf", bytes);
    const items = pdfTextItems(bytes);
    const invoiceClientX = DAILY_NUMBER_X + columnWidth(standard, "numero");
    const noteClientX = LETTER_NUMBER_X + columnWidth(letter, "numero");

    expect(itemsAt(items, TEST_INVOICE_NUMBER, DAILY_NUMBER_X)).toHaveLength(1);
    expect(itemsAt(items, "CLIENTE DIARIO", invoiceClientX)).toHaveLength(1);
    expect(itemsAt(items, TEST_NOTE_NUMBER, LETTER_NUMBER_X)).toHaveLength(1);
    expect(itemsAt(items, "CLIENTE NOTA", noteClientX)).toHaveLength(1);
    expect(columnWidth(standard, "cliente")).toBeGreaterThan(DAILY_CLIENTE);
    expect(columnWidth(letter, "cliente")).toBeGreaterThan(LETTER_CLIENTE);
    expect(columnWidth(standard, "numero")).toBeLessThan(
      columnWidth(letter, "numero"),
    );
    expect(itemsAt(items, "CUIT/DNI", DAILY_ID_X).length).toBeGreaterThan(0);
    expect(itemsAt(items, "CUIT/DNI", LETTER_ID_X).length).toBeGreaterThan(0);
    const text = pdfText(bytes);
    expect(text).toContain("MODO PRUEBA - NO VALIDO COMO LIBRO IVA FISCAL");
    expect(text).toContain(TEST_NOTE_NUMBER);
    expect(text).toContain(formatPdfAmount(1210));

    const invoiceItem = itemsAt(items, TEST_INVOICE_NUMBER, DAILY_NUMBER_X)[0];
    const noteItem = itemsAt(items, TEST_NOTE_NUMBER, LETTER_NUMBER_X)[0];
    expect(invoiceItem).toBeDefined();
    expect(noteItem).toBeDefined();
    if (!invoiceItem || !noteItem) {
      return;
    }
    const invoiceClient = sameRow(items, "CLIENTE DIARIO", invoiceItem.y);
    const noteClient = sameRow(items, "CLIENTE NOTA", noteItem.y);
    const invoiceId = sameRow(items, "20-30445566-7", invoiceItem.y);
    const noteId = sameRow(items, "20-30445566-7", noteItem.y);
    expect(invoiceClient?.x).toBeGreaterThanOrEqual(
      invoiceItem.x + font.widthOfTextAtSize(TEST_INVOICE_NUMBER, FONT_SIZE) + 4,
    );
    expect(noteClient?.x).toBeGreaterThanOrEqual(
      noteItem.x + font.widthOfTextAtSize(TEST_NOTE_NUMBER, FONT_SIZE) + 4,
    );
    expect(invoiceId?.x).toBeGreaterThanOrEqual(
      (invoiceClient?.x ?? 0) +
        font.widthOfTextAtSize("CLIENTE DIARIO", FONT_SIZE) +
        4,
    );
    expect(noteId?.x).toBeGreaterThanOrEqual(
      (noteClient?.x ?? 0) + font.widthOfTextAtSize("CLIENTE NOTA", FONT_SIZE) + 4,
    );
  });

  it("el informe Z simple conserva sus columnas", async () => {
    const production = await buildLibroIvaDailyPdf({
      year: 2026,
      month: 10,
      day: 3,
      rows: [
        row({ issuedAt: new Date(2026, 9, 3, 10, 0, 0) }),
        row({
          number: "0007-00000012",
          issuedAt: new Date(2026, 9, 3, 11, 0, 0),
        }),
      ],
      issuer,
      environment: "PRODUCCION",
      variant: "simple",
    });
    const testMode = await buildLibroIvaDailyPdf({
      year: 2026,
      month: 10,
      day: 3,
      rows: [
        row({ number: TEST_INVOICE_NUMBER }),
        row({
          docKind: "NC",
          number: TEST_NOTE_NUMBER,
          netAmount: -200,
          ivaAmount: -42,
          total: -242,
        }),
      ],
      issuer,
      environment: "MODO_PRUEBA",
    });
    writeSample("z-simple-produccion.pdf", production);
    writeSample("z-simple-prueba.pdf", testMode);

    const productionItems = pdfTextItems(production);
    const testItems = pdfTextItems(testMode);

    expect(itemsAt(productionItems, PRODUCTION_NUMBER, Z_SIMPLE_FROM_X)).toHaveLength(
      1,
    );
    expect(itemsAt(productionItems, "0007-00000012", Z_SIMPLE_TO_X)).toHaveLength(1);
    expect(itemsAt(testItems, TEST_NOTE_NUMBER, Z_SIMPLE_FROM_X)).toHaveLength(1);
    expect(itemsAt(testItems, TEST_NOTE_NUMBER, Z_SIMPLE_TO_X)).toHaveLength(1);
    const productionText = pdfText(production);
    const testText = pdfText(testMode);
    expect(productionText).toContain("TOTAL DE VENTAS DIARIO");
    expect(productionText).toContain(formatPdfAmount(2420));
    expect(testText).toContain(TEST_NOTE_NUMBER);
    expect(testText).toContain(formatPdfAmount(1210));
    expect(testText).toContain(formatPdfAmount(-242));
    expect(productionText).not.toContain("Cliente");
  });
});
