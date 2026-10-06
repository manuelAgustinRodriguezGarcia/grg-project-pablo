import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";

const requireAdmin = vi.hoisted(() => vi.fn());
const probeProductionWsfeDummy = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/guards", () => ({
  requireAdmin,
}));

vi.mock("@/server/arca/wsfe/wsfe-client", () => ({
  probeProductionWsfeDummy,
}));

import { POST } from "@/app/api/admin/arca/diagnostico/wsfe/route";

describe("POST /api/admin/arca/diagnostico/wsfe", () => {
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
    expect(probeProductionWsfeDummy).not.toHaveBeenCalled();
  });

  it("ejecuta FEDummy sin argumentos y devuelve el resultado", async () => {
    requireAdmin.mockResolvedValue({ profile: { role: "ADMINISTRADOR" } });
    probeProductionWsfeDummy.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      appServer: "OK",
      dbServer: "OK",
      authServer: "OK",
    });

    const response = await POST();

    expect(probeProductionWsfeDummy).toHaveBeenCalledTimes(1);
    expect(probeProductionWsfeDummy).toHaveBeenCalledWith();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      httpStatus: 200,
      appServer: "OK",
      dbServer: "OK",
      authServer: "OK",
    });
  });

  it("devuelve el fallo de red sin el cuerpo SOAP", async () => {
    requireAdmin.mockResolvedValue({ profile: { role: "ADMINISTRADOR" } });
    probeProductionWsfeDummy.mockResolvedValue({
      ok: false,
      code: "NETWORK_ERROR",
      network: {
        name: "Error",
        code: "ERR_SSL_DH_KEY_TOO_SMALL",
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      code: "NETWORK_ERROR",
      network: {
        name: "Error",
        code: "ERR_SSL_DH_KEY_TOO_SMALL",
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/token|sign|certificate|BEGIN /i);
  });
});
