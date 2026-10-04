import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BillingNote } from "@/generated/prisma/client";

const schema = readFileSync(
  path.join(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);
const migration = readFileSync(
  path.join(
    process.cwd(),
    "prisma/migrations/20261003193000_billing_note_fiscal_persistence/migration.sql",
  ),
  "utf8",
);

const noteModel = schema.slice(
  schema.indexOf("model BillingNote {"),
  schema.indexOf("model AuditLog {"),
);
const emissionModel = schema.slice(
  schema.indexOf("model BillingArcaEmission {"),
  schema.indexOf("model ArcaAccessTicketCache {"),
);

type NoteSeries = Pick<
  BillingNote,
  | "environment"
  | "pointOfSale"
  | "kind"
  | "invoiceType"
  | "sequenceNumber"
  | "noteNumber"
  | "fiscalStatus"
  | "voucherType"
  | "cae"
>;

function seriesKey(note: NoteSeries): string {
  return [
    note.environment,
    note.pointOfSale,
    note.kind,
    note.invoiceType,
    String(note.sequenceNumber),
  ].join("|");
}

function emissionLinksAreExclusive(
  invoiceId: string | null,
  noteId: string | null,
): boolean {
  return invoiceId === null || noteId === null;
}

describe("persistencia fiscal de BillingNote", () => {
  it("conserva una nota legacy histórica con número intacto y campos fiscales vacíos", () => {
    const historical: NoteSeries = {
      environment: "MODO_PRUEBA",
      pointOfSale: "0007",
      kind: "CREDIT",
      invoiceType: "A",
      sequenceNumber: 1,
      noteNumber: "0007-PRUEBA-NC-000000001",
      fiscalStatus: "INTERNA",
      voucherType: null,
      cae: null,
    };

    expect(historical.noteNumber).toBe("0007-PRUEBA-NC-000000001");
    expect(historical.sequenceNumber).toBe(1);
    expect(historical.fiscalStatus).toBe("INTERNA");
    expect(historical.voucherType).toBeNull();
    expect(historical.cae).toBeNull();
    expect(migration).toContain(
      '"fiscalStatus" "BillingNoteFiscalStatus" NOT NULL DEFAULT \'INTERNA\'',
    );
    expect(migration).toContain('ADD COLUMN "voucherType" INTEGER');
    expect(migration).toContain('ADD COLUMN "cae" TEXT');
    expect(migration).not.toMatch(/UPDATE\s+"BillingNote"/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
  });

  it("separa la serie por ambiente, punto de venta, kind y letra", () => {
    expect(noteModel).toContain(
      '@@unique([environment, pointOfSale, kind, invoiceType, sequenceNumber], map: "BillingNote_series_key")',
    );
    expect(noteModel).not.toContain("@@unique([kind, sequenceNumber])");
    expect(noteModel).not.toMatch(/noteNumber\s+String\s+@unique/);
    expect(migration).toContain('DROP INDEX "BillingNote_kind_sequenceNumber_key"');
    expect(migration).toContain('DROP INDEX "BillingNote_noteNumber_key"');

    const shared = {
      environment: "PRODUCCION" as const,
      pointOfSale: "0007",
      sequenceNumber: 1,
      fiscalStatus: "AUTORIZADA" as const,
      voucherType: null,
      cae: null,
    };
    const notes: NoteSeries[] = [
      {
        ...shared,
        kind: "CREDIT",
        invoiceType: "A",
        noteNumber: "0007-00000001",
      },
      {
        ...shared,
        kind: "DEBIT",
        invoiceType: "A",
        noteNumber: "0007-00000001",
      },
      {
        ...shared,
        kind: "CREDIT",
        invoiceType: "B",
        noteNumber: "0007-00000001",
      },
      {
        ...shared,
        kind: "DEBIT",
        invoiceType: "B",
        noteNumber: "0007-00000001",
      },
    ];

    expect(new Set(notes.map(seriesKey)).size).toBe(4);
    expect(seriesKey(notes[0])).toBe(seriesKey({ ...notes[0] }));
    expect(seriesKey(notes[0])).not.toBe(
      seriesKey({ ...notes[0], sequenceNumber: 2 }),
    );
  });

  it("impide repetir la misma serie y permite el mismo número en otra letra o kind", () => {
    const base: NoteSeries = {
      environment: "HOMOLOGACION",
      pointOfSale: "0007",
      kind: "CREDIT",
      invoiceType: "A",
      sequenceNumber: 1,
      noteNumber: "0007-00000001",
      fiscalStatus: "AUTORIZADA",
      voucherType: 3,
      cae: "12345678901234",
    };
    const duplicate: NoteSeries = { ...base };
    const otherLetter: NoteSeries = { ...base, invoiceType: "B", voucherType: 8 };

    expect(seriesKey(base)).toBe(seriesKey(duplicate));
    expect(seriesKey(base)).not.toBe(seriesKey(otherLetter));
  });

  it("relaciona BillingArcaEmission con una nota o con una factura, nunca con ambas", () => {
    expect(emissionModel).toContain("invoiceId              String?                    @unique");
    expect(emissionModel).toContain(
      "invoice                BillingInvoice?            @relation(fields: [invoiceId], references: [id], onDelete: Restrict)",
    );
    expect(emissionModel).toContain("noteId                 String?                    @unique");
    expect(emissionModel).toContain(
      "note                   BillingNote?               @relation(fields: [noteId], references: [id], onDelete: Restrict)",
    );
    expect(noteModel).toContain("arcaEmission BillingArcaEmission?");
    expect(migration).toContain(
      'ADD CONSTRAINT "BillingArcaEmission_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "BillingNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "BillingArcaEmission_single_document" CHECK ("invoiceId" IS NULL OR "noteId" IS NULL)',
    );
    expect(migration).not.toContain("DROP CONSTRAINT \"BillingArcaEmission_invoiceId_fkey\"");
    expect(migration).not.toMatch(/ALTER INDEX "BillingInvoice_/);

    expect(emissionLinksAreExclusive(null, null)).toBe(true);
    expect(emissionLinksAreExclusive("invoice-1", null)).toBe(true);
    expect(emissionLinksAreExclusive(null, "note-1")).toBe(true);
    expect(emissionLinksAreExclusive("invoice-1", "note-1")).toBe(false);
  });
});
