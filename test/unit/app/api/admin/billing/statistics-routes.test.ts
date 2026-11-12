import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { GET as getSummary } from "@/app/api/admin/billing/statistics/route";
import { GET as getClients } from "@/app/api/admin/billing/statistics/clients/route";
import { GET as getRubros } from "@/app/api/admin/billing/statistics/rubros/route";
import { GET as getYear } from "@/app/api/admin/billing/statistics/year/route";

const getSummaryMock = vi.hoisted(() => vi.fn());
const getClientsMock = vi.hoisted(() => vi.fn());
const getRubrosMock = vi.hoisted(() => vi.fn());
const getYearMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));

vi.mock("@/server/services/billing-statistics.service", () => ({
  billingStatisticsService: {
    getSummary: getSummaryMock,
    getClients: getClientsMock,
    getRubros: getRubrosMock,
    getYear: getYearMock,
  },
}));

describe("rutas de estadísticas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve el resumen que arma el servicio", async () => {
    getSummaryMock.mockResolvedValue({ totals: { total: "10.00" } });

    const response = await getSummary(
      new Request(
        "http://localhost/api/admin/billing/statistics?period=year&year=2026",
      ),
    );

    expect(response.status).toBe(200);
    expect(getSummaryMock.mock.calls[0]?.[0].get("year")).toBe("2026");
    await expect(response.json()).resolves.toEqual({
      totals: { total: "10.00" },
    });
  });

  it("responde 403 si el rol no puede leer estadísticas", async () => {
    getClientsMock.mockRejectedValue(new AuthForbiddenError());

    const response = await getClients(
      new Request("http://localhost/api/admin/billing/statistics/clients?period=year&year=2026"),
    );

    expect(response.status).toBe(403);
  });

  it("responde 400 si el período es inválido", async () => {
    getRubrosMock.mockRejectedValue(
      new BillingInvoiceError(
        "La fecha desde no puede ser posterior a la fecha hasta.",
        "VALIDATION_ERROR",
      ),
    );

    const response = await getRubros(
      new Request(
        "http://localhost/api/admin/billing/statistics/rubros?period=custom&from=2026-04-02&to=2026-04-01",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("devuelve el paquete anual", async () => {
    getYearMock.mockResolvedValue({ year: 2026, months: [] });

    const response = await getYear(
      new Request("http://localhost/api/admin/billing/statistics/year?year=2026"),
    );

    expect(response.status).toBe(200);
    expect(getYearMock.mock.calls[0]?.[0].get("year")).toBe("2026");
    await expect(response.json()).resolves.toEqual({ year: 2026, months: [] });
  });
});
