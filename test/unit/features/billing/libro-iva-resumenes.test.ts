import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { LibroIvaArchiveSummary } from "@/features/billing/types/libro-iva-archive.types";
import {
  LibroIvaArchiveRequestError,
  fetchLibroIvaArchives,
  libroIvaArchiveErrorMessage,
} from "@/features/billing/utils/libro-iva-archive-client";
import {
  LIBRO_IVA_MONTH_FILTER_OPTIONS,
  defaultLibroIvaArchiveYear,
  filenameFromContentDisposition,
  filterLibroIvaArchives,
  groupLibroIvaArchives,
  libroIvaArchiveDocumentLabel,
  libroIvaArchiveYearOptions,
  resolveLibroIvaArchiveStatus,
} from "@/features/billing/utils/libro-iva-resumenes";

function archive(
  overrides: Partial<LibroIvaArchiveSummary> &
    Pick<LibroIvaArchiveSummary, "id" | "year" | "month" | "format" | "fileName">,
): LibroIvaArchiveSummary {
  return {
    environment: "PRODUCCION",
    bookKind: "MONTHLY",
    sizeBytes: 2048,
    fileSha256: "hash",
    fiscalDataSha256: "fiscal",
    generatedAt: "2026-11-02T15:04:00.000Z",
    createdAt: "2026-11-02T15:04:00.000Z",
    updatedAt: "2026-11-02T15:04:00.000Z",
    generatedBy: { id: "user-1", name: "Ana" },
    fiscalSourceChanged: false,
    issued: {
      facturasA: { count: 0, total: 0 },
      facturasB: { count: 0, total: 0 },
      notasCredito: { count: 0, total: 0 },
      notasDebito: { count: 0, total: 0 },
    },
    ...overrides,
  };
}

describe("resúmenes de libros de IVA", () => {
  it("ordena períodos descendentes y no inventa el formato que falta", () => {
    const files = [
      archive({
        id: "xlsx",
        year: 2026,
        month: 10,
        format: "XLSX",
        fileName: "Libro-IVA-OCT-2026.xlsx",
      }),
      archive({
        id: "old",
        year: 2024,
        month: 3,
        format: "PDF",
        fileName: "Libro-IVA-MAR-2024.pdf",
      }),
      archive({
        id: "pdf",
        year: 2026,
        month: 10,
        format: "PDF",
        fileName: "Libro-IVA-OCT-2026.pdf",
      }),
      archive({
        id: "sep",
        year: 2026,
        month: 9,
        format: "PDF",
        fileName: "Libro-IVA-SEP-2026.pdf",
      }),
    ];

    const groups = groupLibroIvaArchives(filterLibroIvaArchives(files, 2026, "all"));

    expect(groups.map((group) => group.heading)).toEqual([
      "OCTUBRE 2026",
      "SEPTIEMBRE 2026",
    ]);
    expect(groups[0]?.files.map((file) => file.format)).toEqual(["PDF", "XLSX"]);
    expect(groups[1]?.files.map((file) => libroIvaArchiveDocumentLabel(file.format))).toEqual([
      "Libro de IVA — PDF",
    ]);
    expect(defaultLibroIvaArchiveYear(files)).toBe(2026);
    expect(defaultLibroIvaArchiveYear([])).toBe(new Date().getFullYear());
    expect(libroIvaArchiveYearOptions(files, 2026)).toContain(2024);
  });

  it("filtra un mes sin ofrecer rangos ni meses fuera del año", () => {
    const files = [
      archive({
        id: "oct",
        year: 2026,
        month: 10,
        format: "PDF",
        fileName: "oct.pdf",
      }),
      archive({
        id: "may",
        year: 2026,
        month: 5,
        format: "XLSX",
        fileName: "may.xlsx",
      }),
    ];

    expect(filterLibroIvaArchives(files, 2026, 5).map((file) => file.id)).toEqual(["may"]);
    expect(filterLibroIvaArchives(files, 2026, 1)).toEqual([]);
    expect(LIBRO_IVA_MONTH_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      "Todos los meses",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ]);
  });

  it("distingue archivado, datos modificados, archivo ausente y no verificado", () => {
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: false }),
    ).toBe("unverified");
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: true }),
    ).toBe("unverified");
    expect(
      resolveLibroIvaArchiveStatus({
        fiscalSourceChanged: false,
        filePresent: true,
      }),
    ).toBe("archived");
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: true, filePresent: true }),
    ).toBe("fiscal-changed");
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: true, filePresent: null }),
    ).toBe("unverified");
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: false, filePresent: false }),
    ).toBe("missing");
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: true, filePresent: false }),
    ).toBe("missing");
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: null, filePresent: true }),
    ).toBe("unverified");
    expect(
      resolveLibroIvaArchiveStatus({ fiscalSourceChanged: false, filePresent: null }),
    ).toBe("unverified");
    expect(
      resolveLibroIvaArchiveStatus({
        fiscalSourceChanged: true,
        markedMissing: true,
      }),
    ).toBe("missing");
  });

  it("respeta el nombre guardado en Content-Disposition", () => {
    expect(filenameFromContentDisposition(null, "respaldo.pdf")).toBe("respaldo.pdf");
    expect(
      filenameFromContentDisposition(
        "attachment; filename=\"Libro-IVA.pdf\"; filename*=UTF-8''Libro-IVA-OCT-2026.pdf",
        "respaldo.pdf",
      ),
    ).toBe("Libro-IVA-OCT-2026.pdf");
  });

  it("traduce sesión vencida, permiso y archivo ausente", () => {
    expect(libroIvaArchiveErrorMessage(401, null, "fallo")).toMatch(/sesión/i);
    expect(libroIvaArchiveErrorMessage(403, null, "fallo")).toMatch(/permiso/i);
    expect(
      libroIvaArchiveErrorMessage(
        404,
        { error: "El archivo histórico no está disponible.", code: "ARCHIVE_FILE_MISSING" },
        "fallo",
      ),
    ).toBe("El archivo histórico no está disponible.");
  });

  it("pide el listado completo una sola vez y rechaza una respuesta vacía", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ nope: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLibroIvaArchives()).rejects.toBeInstanceOf(LibroIvaArchiveRequestError);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/billing/libro-iva/archives", {
      credentials: "include",
      cache: "no-store",
    });
    vi.unstubAllGlobals();
  });

  it("apila las tarjetas en pantallas chicas", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/features/billing/styles/LibroIvaResumenes.module.scss"),
      "utf8",
    );

    expect(css).toMatch(/@media \(max-width: 720px\)/);
    expect(css).toMatch(/grid-template-columns:\s*1fr/);
    expect(css).not.toMatch(/<table/);
  });
});
