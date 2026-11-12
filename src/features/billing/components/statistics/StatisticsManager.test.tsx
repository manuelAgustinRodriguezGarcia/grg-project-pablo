import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatisticsManager } from "@/features/billing/components/statistics/StatisticsManager";

vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    BarChart: Pass,
    Bar: () => <div data-testid="statistics-bar" />,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
    Cell: () => null,
    ReferenceLine: () => null,
    PieChart: Pass,
    Pie: () => <div data-testid="statistics-pie" />,
  };
});

const calls: string[] = [];

function money(total: string, net = total, vat = "0.00") {
  return { net, vat, total, roundingGap: "0.00" };
}

function counts(invoiceCount: number, creditNoteCount = 0, debitNoteCount = 0) {
  return {
    invoiceCount,
    creditNoteCount,
    debitNoteCount,
    documentCount: invoiceCount + creditNoteCount + debitNoteCount,
  };
}

function emptyMonth(year: number, month: number) {
  return {
    year,
    month,
    totals: money("0.00"),
    counts: counts(0),
    invoices: money("0.00"),
    notes: money("0.00"),
    creditNotes: money("0.00"),
    debitNotes: money("0.00"),
    clients: [],
    rubros: [],
    unassigned: { totals: money("0.00"), invoiceCount: 0, lineCount: 0 },
    adjustments: { totals: money("0.00"), counts: counts(0) },
  };
}

function activeMonth(input: {
  year: number;
  month: number;
  total: string;
  clientName: string;
  rubroName?: string;
  credit?: string;
}) {
  const credit = input.credit ?? "0.00";
  const invoiceTotal = (Number(input.total) - Number(credit)).toFixed(2);
  const base = emptyMonth(input.year, input.month);
  return {
    ...base,
    totals: money(input.total, input.total, "0.00"),
    counts: counts(1, credit === "0.00" ? 0 : 1, 0),
    invoices: money(invoiceTotal),
    notes: money(credit),
    creditNotes: money(credit),
    adjustments: {
      totals: money(credit),
      counts: counts(0, credit === "0.00" ? 0 : 1, 0),
    },
    clients: [{
      key: "client:alfa",
      clientId: "alfa",
      identity: "client-id",
      clientCode: "ALFA",
      clientName: input.clientName,
      labelIssuedAt: 1,
      labelNumber: "A",
      totals: money(input.total),
      counts: counts(1, credit === "0.00" ? 0 : 1, 0),
    }],
    rubros: [{
      key: "rubro:frenos",
      rubroId: "frenos",
      identity: "rubro-id",
      rubroCode: "FRE",
      rubroName: input.rubroName ?? "Frenos",
      labelIssuedAt: 1,
      labelSortOrder: 0,
      labelNumber: "A",
      totals: money(invoiceTotal),
      lineCount: 2,
      quantity: "3.50",
      invoiceCount: 1,
    }],
  };
}

function yearPayload(year: number, months: ReturnType<typeof activeMonth>[]) {
  const byMonth = new Map(months.map((item) => [item.month, item]));
  return {
    environment: "PRODUCCION",
    year,
    months: Array.from({ length: 12 }, (_, index) => byMonth.get(index + 1) ?? emptyMonth(year, index + 1)),
    notes: months.flatMap((item) => item.creditNotes.total === "0.00" ? [] : [{
      id: `note-${item.month}`,
      kind: "CREDIT",
      issuedOn: `${year}-${String(item.month).padStart(2, "0")}-15`,
      month: item.month,
      noteNumber: `NC-${item.month}`,
      clientKey: "client:alfa",
      clientName: item.clients[0]?.clientName ?? "Alfa",
      totals: item.creditNotes,
      invoiceId: `fac-${item.month}`,
      invoiceNumber: `0001-000000${item.month}`,
    }]),
  };
}

function renderPage(extra?: {
  initialSection?: "clients" | "rubros";
  initialAnalysis?: "ranking" | "participacion" | "evolucion" | null;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StatisticsManager
        fiscalEnvironment="PRODUCCION"
        initialYear={2026}
        initialMonth={11}
        initialSection={extra?.initialSection}
        initialAnalysis={extra?.initialAnalysis}
      />
    </QueryClientProvider>,
  );
}

function hasAmount(decimal: string) {
  const [whole, fraction = "00"] = decimal.replace("-", "").split(".");
  const needle = `${whole},${fraction}`;
  return (_content: string, element?: Element | null) =>
    Boolean(element && element.childElementCount === 0 && element.textContent?.includes(needle));
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const year = new URL(url, "http://localhost").searchParams.get("year") ?? "2026";
    const numericYear = Number(year);
    const body = numericYear === 2025
      ? yearPayload(2025, [activeMonth({
          year: 2025,
          month: 11,
          total: "20.00",
          clientName: "Cliente 2025",
        })])
      : yearPayload(2026, [
          activeMonth({
            year: 2026,
            month: 2,
            total: "10.00",
            clientName: "SUCESION DE VALLE ROBERTO",
          }),
          activeMonth({
            year: 2026,
            month: 11,
            total: "165.40",
            clientName: "SUCESION DE VALLE ROBERTO",
            credit: "-100.00",
          }),
        ]);
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("estadísticas de facturación", () => {
  it("muestra la grilla de meses sin personalizado ni comparar período", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const html = renderToString(
      <QueryClientProvider client={client}>
        <StatisticsManager fiscalEnvironment="PRODUCCION" initialYear={2026} initialMonth={11} />
      </QueryClientProvider>,
    );

    expect(html).toContain("ENE");
    expect(html).toContain("DIC");
    expect(html).not.toContain("Personalizado");
    expect(html).not.toContain("Comparar período");
    expect(html).not.toContain("recharts");

    renderPage();
    expect(screen.getByRole("button", { name: "Noviembre" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Febrero" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Año completo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Personalizado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Comparar período" })).not.toBeInTheDocument();
    expect(calls.every((url) => !url.includes("environment="))).toBe(true);
  });

  it("carga el año una vez y cambia de meses sin otra consulta", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /SUCESION DE VALLE ROBERTO/ })).toBeInTheDocument();
    expect(screen.getByTestId("statistics-kpis")).toHaveTextContent("165,40");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/admin/billing/statistics/year?year=2026");

    fireEvent.click(screen.getByRole("button", { name: "Febrero" }));
    expect(screen.getByRole("button", { name: "Febrero" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("statistics-kpis")).toHaveTextContent("175,40");
    expect(calls).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Noviembre" }));
    expect(screen.getByTestId("statistics-kpis")).toHaveTextContent("10,00");
    expect(screen.getByTestId("statistics-kpis")).not.toHaveTextContent("165,40");
    expect(calls).toHaveLength(1);

    fireEvent.click(screen.getByRole("tab", { name: "Rubros" }));
    expect(screen.getByRole("button", { name: /Frenos/ })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it("vacía la selección, completa el año y lo desarma", async () => {
    renderPage();
    expect((await screen.findAllByText(hasAmount("165.40"))).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Noviembre" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Seleccioná uno o más meses para consultar sus estadísticas.",
    );
    expect(screen.queryByTestId("statistics-kpis")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Año completo" }));
    expect(screen.getByRole("button", { name: "Año completo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Enero" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("statistics-kpis")).toHaveTextContent("175,40");

    fireEvent.click(screen.getByRole("button", { name: "Enero" }));
    expect(screen.getByRole("button", { name: "Año completo" })).toHaveAttribute("aria-pressed", "false");
    expect(calls.filter((url) => url.includes("/statistics/year"))).toHaveLength(1);
  });

  it("cambia de año sin mostrar el importe del año anterior", async () => {
    renderPage();
    expect((await screen.findAllByText(hasAmount("165.40"))).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Año" }));
    fireEvent.click(screen.getByRole("option", { name: "2025" }));

    expect(screen.queryAllByText(hasAmount("165.40"))).toHaveLength(0);
    expect((await screen.findAllByText(hasAmount("20.00"))).length).toBeGreaterThan(0);
    expect(calls.some((url) => url.includes("year=2025"))).toBe(true);
    expect(screen.getByRole("button", { name: "Noviembre" })).toHaveAttribute("aria-pressed", "true");
  });

  it("lista la nota y enlaza el comprobante y la factura del ambiente", async () => {
    renderPage();
    const note = await screen.findByRole("link", { name: "Ver nota" });
    const invoice = screen.getByRole("link", { name: "Ver factura asociada" });

    expect(note).toHaveAttribute("href", "/api/admin/billing/notes/note-11");
    expect(invoice).toHaveAttribute("href", "/admin/facturacion/facturas?factura=fac-11");
    expect(screen.getByTestId("statistics-notes")).toHaveTextContent("NC-11");
    expect(screen.getByTestId("statistics-notes")).toHaveTextContent("Nota de crédito");
  });

  it("no convierte un importe negativo en una porción de torta", async () => {
    calls.length = 0;
    vi.stubGlobal("fetch", () => {
      calls.push("negative");
      return Promise.resolve(new Response(JSON.stringify(yearPayload(2026, [
        activeMonth({
          year: 2026,
          month: 11,
          total: "-50.00",
          clientName: "Negativo historico",
        }),
      ])), { status: 200, headers: { "Content-Type": "application/json" } }));
    });

    renderPage();
    expect(await screen.findByRole("button", { name: /Negativo historico/ })).toBeInTheDocument();
    expect(screen.getByText(/no los representa como participación positiva/)).toBeInTheDocument();
    expect(screen.queryByTestId("participation-legend")).not.toBeInTheDocument();
  });

  it("informa un error y un ambiente distinto", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(
      JSON.stringify({ error: "No se pudo consultar la facturación." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo consultar la facturación.");

    cleanup();
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(
      JSON.stringify({ ...yearPayload(2026, []), environment: "HOMOLOGACION" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("otro ambiente fiscal");
    expect(screen.queryByTestId("statistics-kpis")).not.toBeInTheDocument();
  });

  it("abre el análisis indicado en la URL", async () => {
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    renderPage({ initialSection: "rubros", initialAnalysis: "ranking" });
    expect(document.querySelector("[data-statistics-root]")).toHaveAttribute(
      "data-statistics-section",
      "rubros",
    );
    expect(await screen.findByRole("tab", { name: "Rubros" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    expect(scrollIntoView.mock.instances.at(-1)).toHaveAttribute("id", "statistics-analysis-ranking");
    HTMLElement.prototype.scrollIntoView = originalScroll;
  });
});
