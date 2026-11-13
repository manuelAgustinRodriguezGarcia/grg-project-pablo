import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminQueryKeys } from "@/features/admin/query-keys";
import type { LibroIvaArchiveSummary } from "@/features/billing/types/libro-iva-archive.types";
import {
  LIBRO_IVA_FISCAL_CHANGED_WARNING,
  LIBRO_IVA_RESUMENES_EMPTY_HINT,
  libroIvaResumenesEmptyMessage,
} from "@/features/billing/utils/libro-iva-resumenes";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { LibroIvaResumenesManager } from "./LibroIvaResumenesManager";

const PDF_ID = `c${"a".repeat(24)}`;
const XLSX_ID = `c${"b".repeat(24)}`;
const SEP_ID = `c${"c".repeat(24)}`;
const AUG_ID = `c${"d".repeat(24)}`;
const OLD_ID = `c${"e".repeat(24)}`;
const HOMO_ID = `c${"f".repeat(24)}`;
const FILE_HASH = "sha-should-not-render";
const PDF_NAME = "Libro-IVA-OCT-2026.pdf";
const XLSX_NAME = "Libro-IVA-OCT-2026.xlsx";
const SEP_NAME = "Libro-IVA-SEP-2026.pdf";

const settingsState = vi.hoisted(() => ({
  environment: "PRODUCCION" as "PRODUCCION" | "HOMOLOGACION" | "MODO_PRUEBA",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/billing/actions/billing-fiscal-settings.actions", () => ({
  getBillingFiscalSettingsAction: vi.fn(async () => ({
    success: true,
    data: { environment: settingsState.environment },
  })),
}));

vi.mock("@/features/billing/styles/ClientsManager.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

vi.mock("@/features/billing/styles/LibroIvaResumenes.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

vi.mock("@/features/admin/styles/AdminTableSkeleton.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

type DetailResult = boolean | null | "fail";

const scenario = {
  archives: [] as LibroIvaArchiveSummary[],
  listStatus: 200,
  listError: "Falló la consulta de resúmenes.",
  details: {} as Record<string, DetailResult>,
  fileStatus: 200,
  fileError: "No se pudo leer el archivo histórico.",
  fileCode: null as string | null,
  fileGate: null as Promise<void> | null,
  fileStarts: 0,
  presenceGate: null as Promise<void> | null,
  presenceStatus: 200,
};

const downloads: string[] = [];
const fetchMock = vi.fn();
const originalClick = HTMLAnchorElement.prototype.click;

function emptyIssued() {
  return {
    facturasA: { count: 0, total: 0 },
    facturasB: { count: 0, total: 0 },
    notasCredito: { count: 0, total: 0 },
    notasDebito: { count: 0, total: 0 },
  };
}

function archive(
  overrides: Partial<LibroIvaArchiveSummary> &
    Pick<LibroIvaArchiveSummary, "id" | "year" | "month" | "format" | "fileName">,
): LibroIvaArchiveSummary {
  return {
    environment: "PRODUCCION",
    bookKind: "MONTHLY",
    sizeBytes: 2048,
    fileSha256: FILE_HASH,
    fiscalDataSha256: "fiscal-sha-should-not-render",
    generatedAt: "2026-11-02T15:04:00.000Z",
    createdAt: "2026-11-02T15:04:00.000Z",
    updatedAt: "2026-11-02T15:04:00.000Z",
    generatedBy: { id: "user-1", name: "Ana" },
    fiscalSourceChanged: false,
    issued: emptyIssued(),
    ...overrides,
  };
}

const OCTOBER_ISSUED = {
  facturasA: { count: 4, total: 1500.5 },
  facturasB: { count: 2, total: 800 },
  notasCredito: { count: 1, total: 300 },
  notasDebito: { count: 0, total: 0 },
};

function productionArchives(): LibroIvaArchiveSummary[] {
  return [
    archive({
      id: XLSX_ID,
      year: 2026,
      month: 10,
      format: "XLSX",
      fileName: XLSX_NAME,
      sizeBytes: 4096,
      fiscalSourceChanged: true,
      issued: OCTOBER_ISSUED,
    }),
    archive({
      id: OLD_ID,
      year: 2024,
      month: 3,
      format: "PDF",
      fileName: "Libro-IVA-MAR-2024.pdf",
    }),
    archive({
      id: PDF_ID,
      year: 2026,
      month: 10,
      format: "PDF",
      fileName: PDF_NAME,
      issued: OCTOBER_ISSUED,
    }),
    archive({
      id: SEP_ID,
      year: 2026,
      month: 9,
      format: "PDF",
      fileName: SEP_NAME,
    }),
    archive({
      id: AUG_ID,
      year: 2026,
      month: 8,
      format: "PDF",
      fileName: "Libro-IVA-AGO-2026.pdf",
      fiscalSourceChanged: null,
    }),
  ];
}

function homoArchive(): LibroIvaArchiveSummary {
  return archive({
    id: HOMO_ID,
    environment: "HOMOLOGACION",
    year: 2025,
    month: 11,
    format: "PDF",
    fileName: "Libro-IVA-NOV-2025.pdf",
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrls(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function listCalls(): string[] {
  return requestUrls().filter((url) => url === "/api/admin/billing/libro-iva/archives");
}

function detailCalls(): string[] {
  return requestUrls().filter(
    (url) =>
      url.startsWith("/api/admin/billing/libro-iva/archives/") &&
      !url.includes("/presence") &&
      !url.endsWith("/file"),
  );
}

function presenceCalls(): string[] {
  return requestUrls().filter((url) => url.includes("/archives/presence"));
}

function choose(selectName: string, optionName: string) {
  fireEvent.click(screen.getByRole("button", { name: selectName }));
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

function renderManager() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LibroIvaResumenesManager initialEnvironment="PRODUCCION" />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  scenario.archives = productionArchives();
  scenario.listStatus = 200;
  scenario.details = Object.fromEntries(scenario.archives.map((item) => [item.id, true]));
  scenario.fileStatus = 200;
  scenario.fileCode = null;
  scenario.fileError = "No se pudo leer el archivo histórico.";
  scenario.fileGate = null;
  scenario.fileStarts = 0;
  scenario.presenceGate = null;
  scenario.presenceStatus = 200;
  settingsState.environment = "PRODUCCION";
  downloads.length = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/admin/billing/libro-iva/archives") {
      if (scenario.listStatus !== 200) {
        return jsonResponse({ error: scenario.listError }, scenario.listStatus);
      }
      return jsonResponse({ archives: scenario.archives });
    }

    if (url.includes("/archives/presence")) {
      if (scenario.presenceGate) {
        await scenario.presenceGate;
      }
      if (scenario.presenceStatus !== 200) {
        return jsonResponse({ error: "No se pudo comprobar el archivo." }, scenario.presenceStatus);
      }
      const ids = new URL(url, "http://localhost").searchParams.getAll("id");
      return jsonResponse({
        files: ids.map((id) => {
          const detail = scenario.details[id];
          if (detail === undefined || detail === "fail") {
            return { id, filePresent: null };
          }
          return { id, filePresent: detail };
        }),
      });
    }

    if (url.endsWith("/file")) {
      scenario.fileStarts += 1;
      if (scenario.fileGate) {
        await scenario.fileGate;
      }
      if (scenario.fileStatus !== 200) {
        return jsonResponse(
          { error: scenario.fileError, code: scenario.fileCode },
          scenario.fileStatus,
        );
      }
      const id = decodeURIComponent(url.split("/").at(-2) ?? "");
      const filename = scenario.archives.find((item) => item.id === id)?.fileName ?? "Libro-IVA.pdf";
      return new Response("archivo", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    const id = decodeURIComponent(url.split("/").pop() ?? "");
    const detail = scenario.details[id];
    if (detail === undefined || detail === "fail") {
      return jsonResponse({ error: "No se pudo consultar el archivo." }, 500);
    }
    const found = scenario.archives.find((item) => item.id === id);
    return jsonResponse({ archive: { ...found, filePresent: detail } });
  });
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:archive");
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    if (this.download) {
      downloads.push(this.download);
    }
  };
});

afterEach(() => {
  HTMLAnchorElement.prototype.click = originalClick;
  vi.unstubAllGlobals();
  cleanup();
});

describe("LibroIvaResumenesManager", () => {
  it("lista un libro por mes y muestra PDF y Excel dentro de esa ficha", async () => {
    renderManager();

    expect(await screen.findByRole("article", { name: "OCTUBRE 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FILTRAR ENTRE LIBROS" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Volver a facturas" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ambiente:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Año" })).toHaveTextContent("2026");
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Todos los meses");

    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual(["2026"]);
    expect(screen.queryByRole("heading", { name: "OCTUBRE 2026" })).not.toBeInTheDocument();

    const october = screen.getByRole("article", { name: "OCTUBRE 2026" });
    expect(within(october).getAllByText("Libro de IVA")).toHaveLength(1);
    expect(within(october).getByText("OCTUBRE")).toBeInTheDocument();
    expect(within(october).getByText("Facturas A")).toBeInTheDocument();
    expect(within(october).getByText("Facturas B")).toBeInTheDocument();
    expect(within(october).getByText("Notas de crédito")).toBeInTheDocument();
    expect(within(october).getByText("Notas de débito")).toBeInTheDocument();
    expect(within(october).getByText("4 FACTURAS")).toBeInTheDocument();
    expect(within(october).getByText("1 NOTA")).toBeInTheDocument();
    expect(october.textContent?.replace(/\s+/g, " ")).toContain(
      formatArsExact(1500.5).replace(/\s+/g, " "),
    );
    expect(within(october).getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
    expect(within(october).getByRole("button", { name: "Descargar Excel" })).toBeInTheDocument();
    expect(within(october).queryByText(PDF_NAME)).not.toBeInTheDocument();
    expect(within(october).queryByText("Archivado")).not.toBeInTheDocument();

    const september = screen.getByRole("article", { name: "SEPTIEMBRE 2026" });
    expect(within(september).getAllByText("Libro de IVA")).toHaveLength(1);
    expect(within(september).getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
    expect(within(september).queryByRole("button", { name: "Descargar Excel" })).not.toBeInTheDocument();

    expect(screen.queryByText("Archivado")).not.toBeInTheDocument();
    expect(await screen.findByText("Datos modificados")).toBeInTheDocument();
    expect(screen.getByText(LIBRO_IVA_FISCAL_CHANGED_WARNING)).toBeInTheDocument();
    expect(screen.queryByText(/verificado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(FILE_HASH)).not.toBeInTheDocument();
    expect(screen.queryByText(PDF_ID)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fiscalmente validado|Aprobado por ARCA|Cierre definitivo/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(listCalls()).toHaveLength(1);
    expect(detailCalls()).toHaveLength(0);
    expect(presenceCalls()).toHaveLength(1);
    const presenceIds = new URL(presenceCalls()[0] ?? "", "http://localhost").searchParams.getAll("id");
    expect(presenceIds).toEqual(expect.arrayContaining([PDF_ID, XLSX_ID, SEP_ID, AUG_ID]));
    expect(presenceIds).toHaveLength(4);
    expect(presenceIds).not.toContain(OLD_ID);
    expect(presenceCalls()[0]).not.toMatch(/\/file|supabase/i);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      cache: "no-store",
    });
  });

  it("filtra por año sin volver a pedir el listado", async () => {
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });

    choose("Año", "2024");

    expect(await screen.findByRole("article", { name: "MARZO 2024" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2024" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "2026" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "OCTUBRE 2026" })).not.toBeInTheDocument();
    expect(listCalls()).toHaveLength(1);
    expect(detailCalls()).toHaveLength(0);
  });

  it("explica un mes sin archivos sin tratarlo como error del servidor", async () => {
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });

    choose("Mes", "Mayo");

    expect(
      await screen.findByText(libroIvaResumenesEmptyMessage(2026, 5, true)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(libroIvaResumenesEmptyMessage(2026, "all", true)),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "OCTUBRE 2026" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Mayo");
    expect(listCalls()).toHaveLength(1);
  });

  it("muestra el período vacío cuando todavía no hay archivos", async () => {
    scenario.archives = [];
    scenario.details = {};
    renderManager();

    expect(
      await screen.findByText(
        libroIvaResumenesEmptyMessage(new Date().getFullYear(), "all", false),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(LIBRO_IVA_RESUMENES_EMPTY_HINT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Año" })).toHaveTextContent(
      String(new Date().getFullYear()),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("comprueba la presencia del año en un solo lote", async () => {
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });
    await waitFor(() => expect(presenceCalls()).toHaveLength(1));
    const ids = new URL(presenceCalls()[0] ?? "", "http://localhost").searchParams.getAll("id");
    expect(ids).toEqual(expect.arrayContaining([PDF_ID, XLSX_ID, SEP_ID, AUG_ID]));
    expect(ids).toHaveLength(4);
    expect(detailCalls()).toHaveLength(0);
    expect(presenceCalls()[0]).not.toMatch(/\/file|supabase/i);
    expect(listCalls()).toHaveLength(1);

    choose("Mes", "Octubre");

    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Octubre");
    expect(screen.getByRole("button", { name: "Año" })).toHaveTextContent("2026");
    expect(screen.getAllByText("Libro de IVA")).toHaveLength(1);
    expect(presenceCalls()).toHaveLength(1);
    expect(detailCalls()).toHaveLength(0);

    choose("Mes", "Todos los meses");
    expect(await screen.findByRole("article", { name: "SEPTIEMBRE 2026" })).toBeInTheDocument();
    expect(listCalls()).toHaveLength(1);
    expect(presenceCalls()).toHaveLength(1);
    expect(detailCalls()).toHaveLength(0);
  });

  it("marca un archivo ausente también cuando se ven todos los meses", async () => {
    scenario.details[SEP_ID] = false;
    renderManager();
    const september = await screen.findByRole("article", { name: "SEPTIEMBRE 2026" });

    await waitFor(() => {
      expect(within(september).getByRole("button", { name: "Descargar PDF" })).toBeDisabled();
    });
    expect(within(september).getByText("Archivo no disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Todos los meses");
    expect(scenario.fileStarts).toBe(0);
    expect(detailCalls()).toHaveLength(0);
    expect(presenceCalls()).toHaveLength(1);
  });

  it("no afirma que el archivo existe mientras la verificación está pendiente", async () => {
    let release: () => void = () => undefined;
    scenario.presenceGate = new Promise((resolve) => {
      release = resolve;
    });
    renderManager();
    const october = await screen.findByRole("article", { name: "OCTUBRE 2026" });

    expect(within(october).queryByText(/verificado/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Archivado")).not.toBeInTheDocument();
    expect(screen.queryByText("Archivo no disponible")).not.toBeInTheDocument();
    expect(within(october).getByRole("button", { name: "Descargar PDF" })).toBeEnabled();
    expect(detailCalls()).toHaveLength(0);

    release();
    expect(await screen.findByText("Datos modificados")).toBeInTheDocument();
    expect(presenceCalls()).toHaveLength(1);
  });

  it("marca el archivo no disponible cuando la metadata dice que no está", async () => {
    scenario.details[PDF_ID] = false;
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });

    choose("Mes", "Octubre");

    const october = screen.getByRole("article", { name: "OCTUBRE 2026" });
    const button = within(october).getByRole("button", { name: "Descargar PDF" });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByText("Archivo no disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar Excel" })).toBeEnabled();
    expect(scenario.fileStarts).toBe(0);
    expect(detailCalls()).toHaveLength(0);
    expect(presenceCalls()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Octubre");
  });

  it("no presenta como archivado un archivo cuya metadata falló", async () => {
    scenario.details[SEP_ID] = "fail";
    renderManager();
    await screen.findByRole("article", { name: "SEPTIEMBRE 2026" });

    choose("Mes", "Septiembre");

    const september = screen.getByRole("article", { name: "SEPTIEMBRE 2026" });
    await waitFor(() => {
      expect(within(september).queryByText(/verificado/i)).not.toBeInTheDocument();
    });
    expect(within(september).queryByText("Archivado")).not.toBeInTheDocument();
    expect(within(september).getByRole("button", { name: "Descargar PDF" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Septiembre");
  });

  it("descarga el archivo histórico con el nombre guardado", async () => {
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });
    const october = screen.getByRole("article", { name: "OCTUBRE 2026" });

    fireEvent.click(within(october).getByRole("button", { name: "Descargar PDF" }));

    await waitFor(() => expect(downloads).toEqual([PDF_NAME]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const fileUrl = requestUrls().find((url) => url.endsWith("/file"));
    expect(fileUrl).toBe(`/api/admin/billing/libro-iva/archives/${PDF_ID}/file`);
    expect(fileUrl).not.toMatch(/supabase|storagePath/i);
    expect(listCalls()).toHaveLength(1);
  });

  it("ignora una segunda pulsación mientras la descarga sigue en curso", async () => {
    let release: () => void = () => undefined;
    scenario.fileGate = new Promise((resolve) => {
      release = resolve;
    });
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });
    const october = screen.getByRole("article", { name: "OCTUBRE 2026" });
    const button = within(october).getByRole("button", { name: "Descargar PDF" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(scenario.fileStarts).toBe(1);
    release();
    await waitFor(() => expect(button).toHaveTextContent("Descargar PDF"));
    expect(scenario.fileStarts).toBe(1);
    expect(screen.getByRole("article", { name: "OCTUBRE 2026" })).toBeInTheDocument();
  });

  it("avisa si el archivo histórico no está y conserva el listado", async () => {
    scenario.fileStatus = 404;
    scenario.fileCode = "ARCHIVE_FILE_MISSING";
    scenario.fileError = "El archivo histórico no está disponible.";
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });
    const october = screen.getByRole("article", { name: "OCTUBRE 2026" });
    const button = within(october).getByRole("button", { name: "Descargar PDF" });

    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El archivo histórico no está disponible.",
    );
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByText("Archivo no disponible")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "OCTUBRE 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Todos los meses");
    fireEvent.click(button);
    expect(scenario.fileStarts).toBe(1);
  });

  it("muestra el error de descarga sin reiniciar los filtros", async () => {
    renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });
    choose("Mes", "Octubre");
    scenario.fileStatus = 500;

    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo leer el archivo histórico.",
    );
    expect(screen.getByRole("article", { name: "OCTUBRE 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "SEPTIEMBRE 2026" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Octubre");
    expect(screen.getByRole("button", { name: "Año" })).toHaveTextContent("2026");
  });

  it("permite reintentar un error de consulta y conserva el mes elegido", async () => {
    const queryClient = renderManager();
    await screen.findByRole("article", { name: "OCTUBRE 2026" });
    choose("Mes", "Octubre");
    scenario.listStatus = 500;

    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.billingLibroIvaArchives("PRODUCCION"),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Falló la consulta de resúmenes.");
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Octubre");
    scenario.listStatus = 200;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("article", { name: "OCTUBRE 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "SEPTIEMBRE 2026" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Octubre");
  });

  it("cambia de ambiente sin conservar los archivos anteriores", async () => {
    const queryClient = renderManager();
    await screen.findByText("OCTUBRE");
    choose("Mes", "Octubre");
    scenario.fileStatus = 500;
    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo leer el archivo histórico.",
    );
    settingsState.environment = "HOMOLOGACION";
    scenario.archives = [homoArchive()];

    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.billingFiscalSettings(),
    });

    expect(await screen.findByText("NOVIEMBRE")).toBeInTheDocument();
    expect(screen.queryByText("OCTUBRE")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ambiente:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Año" })).toHaveTextContent("2025");
    expect(screen.getByRole("button", { name: "Mes" })).toHaveTextContent("Todos los meses");
    expect(listCalls().length).toBeGreaterThanOrEqual(2);
  });
});
