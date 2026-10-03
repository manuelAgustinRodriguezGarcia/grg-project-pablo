import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import {
  FISCAL_POINT_OF_SALE_NOT_CONFIGURED,
  runProductionWsfeReadOnly,
  type ProductionWsfeReadOnlyDependencies,
} from "../../../integration/arca/wsfe-production-live-flow";
import {
  formatProductionWsfeReadOnlyFailure,
  formatProductionWsfeReadOnlySuccess,
} from "../../../integration/arca/wsfe-production-live-report";
import { FISCAL_ISSUER_CUIT_NOT_CONFIGURED } from "../../../integration/arca/wsfe-live-issuer";

const LIVE_TEST_PATH = path.join(
  process.cwd(),
  "test/integration/arca/wsfe-production-live.test.ts",
);
const FLOW_PATH = path.join(
  process.cwd(),
  "test/integration/arca/wsfe-production-live-flow.ts",
);
const SECRET_TOKEN = "token-secreto-no-imprimir";
const SECRET_SIGN = "sign-secreto-no-imprimir";

const FORBIDDEN_SOURCE = [
  "requestCae",
  "FECAESolicitar",
  "issueArcaInvoice",
  "finalizeApprovedArcaEmission",
  "consultVoucher",
  "FECompConsultar",
  "BillingInvoice",
  "BillingArcaEmission",
  "getOrCreate",
  "https://",
] as const;

function productionTicket(): ArcaAccessTicket {
  return {
    token: SECRET_TOKEN,
    sign: SECRET_SIGN,
    generationTime: new Date("2026-10-02T12:00:00.000Z"),
    expirationTime: new Date("2026-10-02T23:00:00.000Z"),
    service: "wsfe",
    environment: "PRODUCCION",
  };
}

function dependencies(input?: {
  lastFacturaA?: number;
  lastFacturaB?: number;
  ticket?: ArcaAccessTicket;
}): ProductionWsfeReadOnlyDependencies & {
  calls: string[];
} {
  const calls: string[] = [];
  const ticket = input?.ticket ?? productionTicket();

  return {
    calls,
    async getAccessTicket(environment) {
      calls.push(`ticket:${environment}`);
      return ticket;
    },
    async getMaxRecordsPerRequest(query) {
      calls.push(`max:${query.environment}:${query.issuerCuit}`);
      return { maxRecords: 250 };
    },
    async getLastAuthorizedVoucher(query) {
      calls.push(
        `last:${query.environment}:${query.pointOfSale}:${query.voucherType}`,
      );
      return {
        pointOfSale: query.pointOfSale,
        voucherType: query.voucherType,
        lastNumber: query.voucherType === 1
          ? (input?.lastFacturaA ?? 0)
          : (input?.lastFacturaB ?? 0),
      };
    },
  };
}

describe("consulta read-only de WSFE producción", () => {
  it("usa producción, el punto de venta fiscal y no fija el último número", async () => {
    const deps = dependencies({ lastFacturaA: 0, lastFacturaB: 0 });

    const result = await runProductionWsfeReadOnly(
      { issuerCuit: "30-71234567-8", pointOfSale: "0007" },
      deps,
    );

    expect(result).toEqual({
      pointOfSale: 7,
      maxRecordsPerRequest: 250,
      lastFacturaA: 0,
      lastFacturaB: 0,
    });
    expect(formatProductionWsfeReadOnlySuccess(result)).toContain("lastFacturaA: 0");
    expect(formatProductionWsfeReadOnlySuccess(result)).toContain("lastFacturaB: 0");
    expect(deps.calls).toEqual([
      "ticket:PRODUCCION",
      "max:PRODUCCION:30712345678",
      "last:PRODUCCION:7:1",
      "last:PRODUCCION:7:6",
    ]);
    expect(deps.calls.filter((call) => call.startsWith("max:"))).toHaveLength(1);
  });

  it("acepta otros últimos números y otro punto de venta configurado", async () => {
    const deps = dependencies({
      lastFacturaA: 120,
      lastFacturaB: 45,
    });

    const result = await runProductionWsfeReadOnly(
      { issuerCuit: "30712345678", pointOfSale: "0012" },
      deps,
    );

    expect(result.lastFacturaA).toBe(120);
    expect(result.lastFacturaB).toBe(45);
    expect(result.pointOfSale).toBe(12);
    expect(deps.calls).toContain("last:PRODUCCION:12:1");
    expect(deps.calls).toContain("last:PRODUCCION:12:6");
    expect(formatProductionWsfeReadOnlySuccess(result)).toBe(
      [
        "ARCA WSFE PRODUCCION READ ONLY OK",
        "pointOfSale: 12",
        "maxRecordsPerRequest: 250",
        "lastFacturaA: 120",
        "lastFacturaB: 45",
      ].join("\n"),
    );
  });

  it("no consulta ARCA si el CUIT o el punto de venta no sirven", async () => {
    const missingCuit = dependencies();
    const invalidPointOfSale = dependencies();

    await expect(
      runProductionWsfeReadOnly(
        { issuerCuit: null, pointOfSale: "0007" },
        missingCuit,
      ),
    ).rejects.toThrow(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);
    await expect(
      runProductionWsfeReadOnly(
        { issuerCuit: "20-123", pointOfSale: "0007" },
        missingCuit,
      ),
    ).rejects.toThrow(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);
    await expect(
      runProductionWsfeReadOnly(
        { issuerCuit: "30712345678", pointOfSale: "0000" },
        invalidPointOfSale,
      ),
    ).rejects.toThrow(FISCAL_POINT_OF_SALE_NOT_CONFIGURED);

    expect(missingCuit.calls).toEqual([]);
    expect(invalidPointOfSale.calls).toEqual([]);
  });

  it("rechaza un ticket que no es de producción antes de las consultas", async () => {
    const deps = dependencies({
      ticket: { ...productionTicket(), environment: "HOMOLOGACION" },
    });

    await expect(
      runProductionWsfeReadOnly(
        { issuerCuit: "30712345678", pointOfSale: "0007" },
        deps,
      ),
    ).rejects.toThrow(/code: INVALID_TICKET/);
    expect(deps.calls).toEqual(["ticket:PRODUCCION"]);
  });
});

describe("informe read-only de WSFE producción", () => {
  it("no imprime token, sign ni SOAP", () => {
    const report = formatProductionWsfeReadOnlyFailure(
      new ArcaWsfeError("No se pudo conectar con WSFEv1.", "SOAP_FAULT", {
        faultCode: "soap:Server",
        faultString: `<soapenv:Fault>${SECRET_TOKEN} ${SECRET_SIGN}</soapenv:Fault>`,
      }),
    );

    expect(report).toContain("code: SOAP_FAULT");
    expect(report).toContain("message: No se pudo conectar con WSFEv1.");
    expect(report).not.toContain(SECRET_TOKEN);
    expect(report).not.toContain(SECRET_SIGN);
    expect(report).not.toContain("<soap");
  });

  it("no repite un error inesperado", () => {
    const report = formatProductionWsfeReadOnlyFailure(
      new Error(`postgres ${SECRET_TOKEN}`),
    );

    expect(report).toContain("code: UNEXPECTED");
    expect(report).not.toContain(SECRET_TOKEN);
  });
});

describe("aislamiento del live test de WSFE producción", () => {
  it("no emite, no persiste y no fija el último número", () => {
    const liveSource = readFileSync(LIVE_TEST_PATH, "utf8");
    const flowSource = readFileSync(FLOW_PATH, "utf8");

    for (const source of [liveSource, flowSource]) {
      for (const forbidden of FORBIDDEN_SOURCE) {
        expect(source).not.toContain(forbidden);
      }
    }

    expect(liveSource).toContain('process.env.ARCA_PROD_WSFE_LIVE_TEST === "1"');
    expect(liveSource).toContain("describe.skipIf(!LIVE_ENABLED)");
    expect(liveSource.indexOf("describe.skipIf(!LIVE_ENABLED)")).toBeLessThan(
      liveSource.indexOf("loadNextLocalEnv();"),
    );
    const enabledBody = liveSource.slice(liveSource.indexOf("loadNextLocalEnv();"));
    expect(enabledBody.indexOf("missing.length > 0")).toBeLessThan(
      enabledBody.indexOf("readFiscalIssuer()"),
    );
    expect(enabledBody.indexOf("readFiscalIssuer()")).toBeLessThan(
      enabledBody.indexOf("runProductionWsfeReadOnly"),
    );
    expect(liveSource).toContain('resolveArcaEndpoints("PRODUCCION")');
    expect(liveSource).toContain("getValidArcaAccessTicket(environment)");
    expect(liveSource).toContain("getMaxRecordsPerRequest");
    expect(liveSource).toContain("getLastAuthorizedVoucher");
    expect(liveSource).toContain("issuerCuit: true");
    expect(liveSource).toContain("pointOfSale: true");
    expect(liveSource).toContain("findUnique");
    expect(liveSource).not.toContain("environment: true");
    expect(liveSource).not.toContain(".create(");
    expect(liveSource).not.toContain(".update(");
    expect(liveSource).not.toContain(".upsert(");
    expect(liveSource).not.toContain(".delete(");
    expect(flowSource).not.toContain(".create(");
    expect(flowSource).not.toContain(".update(");
    expect(flowSource).not.toContain(".upsert(");
    expect(flowSource).not.toContain(".delete(");
    expect(flowSource).toContain("resolveArcaEndpoints(PRODUCTION_WSFE_ENVIRONMENT)");
    expect(flowSource).toContain('PRODUCTION_WSFE_ENVIRONMENT = "PRODUCCION"');
    expect(flowSource).toContain("voucherType: FACTURA_A_VOUCHER_TYPE");
    expect(flowSource).toContain("voucherType: FACTURA_B_VOUCHER_TYPE");
    expect(flowSource).not.toContain("settings.environment");
    expect(flowSource).not.toContain("lastNumber !==");
    expect(flowSource).not.toContain("lastNumber ===");
  });
});
