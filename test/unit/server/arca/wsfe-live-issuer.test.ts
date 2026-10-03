import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  FISCAL_ISSUER_CUIT_NOT_CONFIGURED,
  continueAfterIssuerCuit,
} from "../../../integration/arca/wsfe-live-issuer";

const LIVE_TEST_PATH = path.join(
  process.cwd(),
  "test/integration/arca/wsfe-live.test.ts",
);

describe("CUIT fiscal del live test WSFE", () => {
  it("no deriva el CUIT del certificado", () => {
    const source = readFileSync(LIVE_TEST_PATH, "utf8");

    expect(source).not.toContain("node-forge");
    expect(source).not.toContain("certificateFromPem");
    expect(source).not.toContain("getArcaCertificate");
    expect(source).not.toContain("serialNumber");
    expect(source).not.toContain("issuerCuitFromCertificate");
    expect(source).not.toContain("requestWsaaTicket");
    expect(source).not.toContain("FECAESolicitar");
    expect(source).not.toContain("FECAEARegInformativo");
    expect(source).not.toContain("FECompConsultar");
    const readSettingsAt = source.indexOf("findUnique");
    const validatedCuitAt = source.indexOf("continueAfterIssuerCuit(settings");
    const ticketCallAt = source.indexOf('await getValidArcaAccessTicket("HOMOLOGACION")');
    expect(readSettingsAt).toBeGreaterThan(-1);
    expect(validatedCuitAt).toBeGreaterThan(readSettingsAt);
    expect(ticketCallAt).toBeGreaterThan(validatedCuitAt);
  });

  it("aborta antes de WSAA si no hay configuración fiscal", async () => {
    const next = vi.fn();

    await expect(continueAfterIssuerCuit(null, next)).rejects.toThrow(
      FISCAL_ISSUER_CUIT_NOT_CONFIGURED,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("aborta antes de WSAA si issuerCuit falta", async () => {
    const next = vi.fn();

    await expect(
      continueAfterIssuerCuit({ issuerCuit: null }, next),
    ).rejects.toThrow(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);
    await expect(
      continueAfterIssuerCuit({ issuerCuit: "   " }, next),
    ).rejects.toThrow(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);
    expect(next).not.toHaveBeenCalled();
  });

  it("aborta antes de WSAA si issuerCuit no tiene 11 dígitos", async () => {
    const next = vi.fn();
    const invalidCuit = "20-123";

    await expect(
      continueAfterIssuerCuit({ issuerCuit: invalidCuit }, next),
    ).rejects.toThrow(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);

    try {
      await continueAfterIssuerCuit({ issuerCuit: invalidCuit }, next);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(invalidCuit);
      expect((error as Error).message).not.toContain("20123");
    }

    expect(next).not.toHaveBeenCalled();
  });

  it("normaliza el CUIT fiscal y solo entonces continúa", async () => {
    const next = vi.fn(async () => "ok");

    await expect(
      continueAfterIssuerCuit({ issuerCuit: "30-71234567-8" }, next),
    ).resolves.toBe("ok");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith("30712345678");
  });
});
