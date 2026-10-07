import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";

const requireAdmin = vi.hoisted(() => vi.fn());
const probeProductionLastAuthorizedFacturaA = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/guards", () => ({
  requireAdmin,
}));

vi.mock("@/server/arca/diagnostico/ultimo-autorizado", () => ({
  probeProductionLastAuthorizedFacturaA,
}));

import { POST } from "@/app/api/admin/arca/diagnostico/ultimo-autorizado/route";

describe("POST /api/admin/arca/diagnostico/ultimo-autorizado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no acepta parámetros y exige administrador", () => {
    expect(POST.length).toBe(0);
  });

  it("rechaza a quien no es administrador", async () => {
    requireAdmin.mockRejectedValue(new AuthForbiddenError());

    const response = await POST();

    expect(response.status).toBe(403);
    expect(probeProductionLastAuthorizedFacturaA).not.toHaveBeenCalled();
  });

  it("ejecuta la consulta sin argumentos", async () => {
    requireAdmin.mockResolvedValue({ profile: { role: "ADMINISTRADOR" } });
    probeProductionLastAuthorizedFacturaA.mockResolvedValue({
      ok: true,
      environment: "PRODUCCION",
      pointOfSale: 7,
      voucherType: 1,
      lastAuthorizedNumber: 1,
      nodeVersion: "v24.21.0",
      opensslVersion: "3.5.8",
      vercelRegion: "iad1",
    });

    const response = await POST();

    expect(probeProductionLastAuthorizedFacturaA).toHaveBeenCalledTimes(1);
    expect(probeProductionLastAuthorizedFacturaA).toHaveBeenCalledWith();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      environment: "PRODUCCION",
      pointOfSale: 7,
      voucherType: 1,
      lastAuthorizedNumber: 1,
      nodeVersion: "v24.21.0",
      opensslVersion: "3.5.8",
      vercelRegion: "iad1",
    });
  });

  it("no consulta ARCA cuando la configuración no coincide", async () => {
    requireAdmin.mockResolvedValue({ profile: { role: "ADMINISTRADOR" } });
    probeProductionLastAuthorizedFacturaA.mockResolvedValue({
      ok: false,
      code: "FISCAL_CONFIGURATION_MISMATCH",
      error: "La configuración fiscal no corresponde a producción, punto de venta 0007.",
    });

    const response = await POST();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "FISCAL_CONFIGURATION_MISMATCH",
    });
  });
});
