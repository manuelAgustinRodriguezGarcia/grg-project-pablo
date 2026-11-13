import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/generated/prisma/client";
import { requirePermission } from "@/server/auth";
import { AuthForbiddenError } from "@/server/auth/errors";
import { hasPermission } from "@/shared/auth/permissions";
import { billingStatisticsRepository } from "@/server/repositories/billing-statistics.repository";
import { readActiveFiscalEnvironment } from "@/server/services/billing-fiscal-scope";
import { billingStatisticsService } from "@/server/services/billing-statistics.service";
import type { StatisticsSource } from "@/server/services/billing-statistics/source";

const findSource = vi.hoisted(() => vi.fn());
const findInvoicedYears = vi.hoisted(() => vi.fn());
const readEnvironment = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/server/services/billing-fiscal-scope", () => ({
  readActiveFiscalEnvironment: readEnvironment,
}));

vi.mock("@/server/repositories/billing-statistics.repository", () => ({
  billingStatisticsRepository: {
    findSource,
    findInvoicedYears,
  },
}));

const roleState: { role: UserRole } = { role: "ADMINISTRADOR" };

const source: StatisticsSource = {
  invoices: [
    {
      id: "inv-1",
      issuedAt: new Date(2026, 2, 15),
      invoiceNumber: "0007-00000001",
      clientId: "client-sur",
      clientCode: "CLI-0001",
      clientName: "Taller Sur",
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: "30712345671",
      total: "165.00",
      ivaAmount: "28.64",
      totalVisualRounded: "165.00",
      items: [
        {
          rubroId: "rubro-emb",
          rubroCode: "EMB-0001",
          rubroName: "Embragues",
          quantity: "1.00",
          lineTotal: "100.00",
          sortOrder: 0,
        },
        {
          rubroId: "rubro-fil",
          rubroCode: "FIL-0001",
          rubroName: "Filtros",
          quantity: "1.00",
          lineTotal: "50.00",
          sortOrder: 1,
        },
        {
          rubroId: "rubro-fre",
          rubroCode: "FRE-0001",
          rubroName: "Frenos",
          quantity: "1.00",
          lineTotal: "33.33",
          sortOrder: 2,
        },
      ],
    },
  ],
  notes: [],
};

describe("servicio de estadísticas", () => {
  beforeEach(() => {
    roleState.role = "ADMINISTRADOR";
    readEnvironment.mockResolvedValue("PRODUCCION");
    findSource.mockResolvedValue(source);
    findInvoicedYears.mockResolvedValue([2026]);
    vi.mocked(requirePermission).mockImplementation(async (permission) => {
      if (!hasPermission(roleState.role, permission)) {
        throw new AuthForbiddenError();
      }
      return {
        profile: {
          id: "user-1",
          role: roleState.role,
          email: "agencygrg@gmail.com",
        },
      } as Awaited<ReturnType<typeof requirePermission>>;
    });
  });

  it("calcula el resumen del ambiente activo y no acepta otro ambiente", async () => {
    const summary = await billingStatisticsService.getSummary(
      new URLSearchParams("period=month&year=2026&month=3"),
    );

    expect(requirePermission).toHaveBeenCalledWith("statistics.read");
    expect(readActiveFiscalEnvironment).toHaveBeenCalledTimes(1);
    expect(billingStatisticsRepository.findSource).toHaveBeenCalledWith(
      { from: new Date(2026, 2, 1), to: new Date(2026, 3, 1) },
      "PRODUCCION",
    );
    expect(summary.environment).toBe("PRODUCCION");
    expect(summary.totals.total).toBe("165.00");
    expect(summary.totals.net).toBe("136.36");
    expect(summary.reconciliation.distributionMatchGeneral).toBe(true);
    expect(summary.monthly).toHaveLength(1);
    expect(JSON.stringify(summary)).not.toContain("30712345671");

    findSource.mockClear();
    await expect(
      billingStatisticsService.getSummary(
        new URLSearchParams(
          "period=month&year=2026&month=3&environment=HOMOLOGACION",
        ),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(findSource).not.toHaveBeenCalled();
  });

  it("autoriza al visitante avanzado y rechaza vendedor y visitante antes de consultar", async () => {
    roleState.role = "VISITANTE_AVANZADO";
    await expect(
      billingStatisticsService.getClients(
        new URLSearchParams("period=year&year=2026&limit=1"),
      ),
    ).resolves.toMatchObject({
      ranking: { returned: 1, totalGroups: 1 },
    });

    for (const role of ["VENDEDOR", "VISITANTE"] as const) {
      roleState.role = role;
      findSource.mockClear();
      readEnvironment.mockClear();
      await expect(
        billingStatisticsService.getRubros(
          new URLSearchParams("period=month&year=2026&month=3"),
        ),
      ).rejects.toBeInstanceOf(AuthForbiddenError);
      expect(findSource).not.toHaveBeenCalled();
      expect(readEnvironment).not.toHaveBeenCalled();
    }
  });

  it("compara otro período del mismo ambiente", async () => {
    findSource.mockImplementation(async () => ({ invoices: [], notes: [] }));
    await billingStatisticsService.getSummary(
      new URLSearchParams(
        "period=year&year=2026&comparePeriod=year&compareYear=2025",
      ),
    );

    expect(findSource).toHaveBeenNthCalledWith(
      1,
      { from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) },
      "PRODUCCION",
    );
    expect(findSource).toHaveBeenNthCalledWith(
      2,
      { from: new Date(2025, 0, 1), to: new Date(2026, 0, 1) },
      "PRODUCCION",
    );
  });

  it("arma el año con una sola lectura y rechaza otro ambiente en la consulta", async () => {
    findSource.mockClear();
    const year = await billingStatisticsService.getYear(new URLSearchParams("year=2026"));

    expect(findSource).toHaveBeenCalledTimes(1);
    expect(findSource).toHaveBeenCalledWith(
      { from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) },
      "PRODUCCION",
    );
    expect(year.year).toBe(2026);
    expect(year.months).toHaveLength(12);
    expect(year.months[2]?.totals.total).toBe("165.00");
    expect(year.months[0]?.totals.total).toBe("0.00");

    findSource.mockClear();
    await expect(
      billingStatisticsService.getYear(new URLSearchParams("year=2026&environment=HOMOLOGACION")),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(findSource).not.toHaveBeenCalled();
  });

  it("entrega el paquete anual a cualquier administrador", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      profile: {
        id: "user-2",
        role: "ADMINISTRADOR",
        email: "otro@rothamel.com",
      },
    } as Awaited<ReturnType<typeof requirePermission>>);

    await expect(
      billingStatisticsService.getYear(new URLSearchParams("year=2026")),
    ).resolves.toMatchObject({ year: 2026 });
  });

  it("pide los años facturados desde 2026 y no consulta años anteriores", async () => {
    findInvoicedYears.mockClear();
    await expect(
      billingStatisticsService.listInvoicedYears(new Date(2028, 0, 2)),
    ).resolves.toEqual([2026]);
    expect(findInvoicedYears).toHaveBeenCalledWith("PRODUCCION", 2026, 2028);

    findInvoicedYears.mockClear();
    await expect(
      billingStatisticsService.listInvoicedYears(new Date(2025, 5, 1)),
    ).resolves.toEqual([]);
    expect(findInvoicedYears).not.toHaveBeenCalled();
  });
});
