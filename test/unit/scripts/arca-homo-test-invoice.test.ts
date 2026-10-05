import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { FinalizeApprovedResult } from "@/server/arca/invoices/finalize-approved-arca-emission";
import type { IssueArcaInvoiceResult } from "@/server/arca/invoices/issue-arca-invoice";
import {
  assertExecuteGuards,
  assertHomoCredentialNamesPresent,
  assertHomoHarnessArgs,
  buildHomoInvoiceIntention,
  describeHomoDryRun,
  executeHomoHarness,
  formatHomoVerify,
  HomoHarnessAbort,
  parseHomoHarnessArgs,
  redactHarnessText,
  SAME_KEY_RETRY_MESSAGE,
  toIssueArcaInvoiceInput,
} from "../../../scripts/arca-homo-test-invoice-plan";

const KEY = "11111111-1111-4111-8111-111111111111";
const CLIENT_CUIT = "30500010912";
const ISSUER_CUIT = "30712345671";
const CAE = "71234567890123";

function args(argv: string[]) {
  return parseHomoHarnessArgs(argv);
}

function intentionFixture(
  overrides: Partial<{
    environment: string;
    invoiceType: string;
    voucherType: number;
    pointOfSale: number;
  }> = {},
) {
  return {
    environment: "HOMOLOGACION",
    invoiceType: "A",
    voucherType: 1,
    pointOfSale: 7,
    ...overrides,
  };
}

function approvedInvoice(): FinalizeApprovedResult["invoice"] {
  return {
    id: "inv-homo",
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    invoiceType: "A",
    pointOfSale: "0007",
    sequenceNumber: 4,
    invoiceNumber: "0007-00000004",
    issuedAt: "2026-10-05T03:00:00.000Z",
    clientId: "client-1",
    clientCode: "C-1",
    clientName: "Cliente",
    clientAddress: null,
    clientCity: null,
    clientProvince: null,
    clientEmail: null,
    clientWhatsapp: null,
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: CLIENT_CUIT,
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    subtotalCents: 100_000,
    discountPercent: "0.00",
    discountAmountCents: 0,
    ivaPercent: "21.00",
    ivaAmountCents: 21_000,
    totalCents: 121_000,
    totalVisualRoundedCents: 121_000,
    paymentMethod: "CONTADO",
    paymentStatus: "PAGA",
    notes: null,
    cae: CAE,
    caeExpiresAt: "2026-10-15T00:00:00.000Z",
    qrUrl: null,
    items: [],
  };
}

function approvedResult(): IssueArcaInvoiceResult {
  return {
    status: "approved",
    emissionId: "em-1",
    voucherType: 1,
    voucherNumber: 4,
    authorizationCode: CAE,
    authorizationExpiresAt: "2026-10-15T00:00:00.000Z",
  };
}

describe("argumentos del harness", () => {
  it("aborta --execute sin confirmación", () => {
    expect(() =>
      assertHomoHarnessArgs(
        args(["--execute", "--client-id=client-1", `--idempotency-key=${KEY}`]),
      ),
    ).toThrow(/confirm-homologacion/);
  });

  it("aborta --execute sin UUID", () => {
    expect(() =>
      assertHomoHarnessArgs(
        args(["--execute", "--confirm-homologacion", "--client-id=client-1"]),
      ),
    ).toThrow(/idempotency-key/);
  });

  it("no acepta forzar la letra por CLI", () => {
    expect(() => parseHomoHarnessArgs(["--invoice-type=B"])).toThrow(HomoHarnessAbort);
  });

  it("aborta un UUID inválido", () => {
    expect(() =>
      assertHomoHarnessArgs(
        args([
          "--execute",
          "--confirm-homologacion",
          "--client-id=client-1",
          "--idempotency-key=no-es-uuid",
        ]),
      ),
    ).toThrow(/UUID/);
  });
});

describe("guards de esta factura", () => {
  it("aborta un ambiente distinto de HOMOLOGACION", () => {
    expect(() =>
      assertExecuteGuards(intentionFixture({ environment: "PRODUCCION" })),
    ).toThrow(/HOMOLOGACION/);
  });

  it("aborta una factura distinta de A", () => {
    expect(() => assertExecuteGuards(intentionFixture({ invoiceType: "B" }))).toThrow(
      /no es A/,
    );
  });

  it("aborta un voucherType distinto de 1", () => {
    expect(() => assertExecuteGuards(intentionFixture({ voucherType: 6 }))).toThrow(
      /no es 1/,
    );
  });
});

describe("intención compartida", () => {
  const issuedAt = new Date("2026-10-05T03:00:00.000Z");

  function build() {
    return buildHomoInvoiceIntention({
      issuedAt,
      settings: {
        environment: "PRODUCCION",
        pointOfSale: "0007",
        issuerCuit: ISSUER_CUIT,
        genericClientLimit: { toNumber: () => 400_000 },
        updatedAt: new Date("2026-10-02T15:03:21.436Z"),
      },
      client: {
        id: "client-1",
        code: "C-1",
        name: "Cliente RI",
        address: null,
        city: null,
        province: null,
        email: null,
        whatsapp: null,
        identificationType: "CUIT",
        identificationNumber: CLIENT_CUIT,
        ivaCondition: "RESPONSABLE_INSCRIPTO",
      },
    });
  }

  it("arma Factura A de HOMOLOGACION aunque la configuración esté en PRODUCCION", () => {
    const intention = build();

    expect(intention.environment).toBe("HOMOLOGACION");
    expect(intention.invoiceType).toBe("A");
    expect(intention.voucherType).toBe(1);
    expect(intention.pointOfSale).toBe(7);
    expect(intention.billing.client.id).toBe("client-1");
    expect(intention.totals.netCents).toBe(100_000);
    expect(intention.totals.ivaCents).toBe(21_000);
    expect(intention.totals.totalCents).toBe(121_000);
  });

  it("el input de issueArcaInvoice no lleva número simulado", () => {
    const input = toIssueArcaInvoiceInput(build(), KEY, ISSUER_CUIT);

    expect(input.idempotencyKey).toBe(KEY);
    expect(input.environment).toBe("HOMOLOGACION");
    expect(input.invoiceType).toBe("A");
    expect(input).not.toHaveProperty("voucherNumber");
  });

  it("el dry-run no incluye el CUIT completo ni escribe", () => {
    const summary = describeHomoDryRun({
      intention: build(),
      issuerCuit: ISSUER_CUIT,
      pointOfSaleText: "0007",
      settingsEnvironment: "PRODUCCION",
      settingsUpdatedAt: "2026-10-02T15:03:21.436Z",
      networkCalls: 0,
    });
    const text = JSON.stringify(summary);

    expect(text).not.toContain(CLIENT_CUIT);
    expect(text).not.toContain(ISSUER_CUIT);
    expect(text).toContain('"wsaa":0');
    expect(text).toContain('"wsfe":0');
    expect(text).toContain('"escriturasDb":0');
    expect(text).toContain('"voucherNumberEsFiscal":false');
  });
});

describe("execute", () => {
  const issuedAt = new Date("2026-10-05T03:00:00.000Z");
  const intention = buildHomoInvoiceIntention({
    issuedAt,
    settings: {
      environment: "PRODUCCION",
      pointOfSale: "0007",
      issuerCuit: ISSUER_CUIT,
      genericClientLimit: { toNumber: () => 400_000 },
      updatedAt: issuedAt,
    },
    client: {
      id: "client-1",
      code: "C-1",
      name: "Cliente RI",
      address: null,
      city: null,
      province: null,
      email: null,
      whatsapp: null,
      identificationType: "CUIT",
      identificationNumber: CLIENT_CUIT,
      ivaCondition: "RESPONSABLE_INSCRIPTO",
    },
  });

  it("llama a issueArcaInvoice una sola vez y no imprime el CAE", async () => {
    const issueArcaInvoice = vi.fn(async () => approvedResult());
    const finalizeApprovedArcaEmission = vi.fn(async () => ({
      status: "completed" as const,
      emissionId: "em-1",
      invoice: approvedInvoice(),
    }));
    const report = await executeHomoHarness(
      intention,
      KEY,
      ISSUER_CUIT,
      { issueArcaInvoice, finalizeApprovedArcaEmission },
    );

    expect(issueArcaInvoice).toHaveBeenCalledTimes(1);
    expect(issueArcaInvoice.mock.calls[0]?.[0].idempotencyKey).toBe(KEY);
    expect(issueArcaInvoice.mock.calls[0]?.[0].environment).toBe("HOMOLOGACION");
    expect(report.exitCode).toBe(0);
    expect(report.text).toContain("STATUS: COMPLETED");
    expect(report.text).toContain("CAE PRESENTE: true");
    expect(report.text).not.toContain(CAE);
    expect(report.text).not.toContain("BEGIN CERTIFICATE");
    expect(report.text).not.toContain("BEGIN PRIVATE KEY");
  });

  it("un retry conserva la misma idempotencyKey", async () => {
    const issueArcaInvoice = vi.fn(async () => approvedResult());
    const finalizeApprovedArcaEmission = vi.fn(async () => ({
      status: "completed" as const,
      emissionId: "em-1",
      invoice: approvedInvoice(),
    }));

    await executeHomoHarness(intention, KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission,
    });
    await executeHomoHarness(intention, KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission,
    });

    expect(issueArcaInvoice).toHaveBeenCalledTimes(2);
    expect(issueArcaInvoice.mock.calls[0]?.[0].idempotencyKey).toBe(KEY);
    expect(issueArcaInvoice.mock.calls[1]?.[0].idempotencyKey).toBe(KEY);
  });

  it("AMBIGUOUS pide reejecutar la misma key", async () => {
    const issueArcaInvoice = vi.fn(
      async (): Promise<IssueArcaInvoiceResult> => ({
        status: "ambiguous",
        emissionId: "em-1",
        voucherType: 1,
        voucherNumber: 4,
        code: "TIMEOUT",
      }),
    );
    const report = await executeHomoHarness(intention, KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission: vi.fn(),
    });

    expect(report.exitCode).toBe(2);
    expect(report.text).toContain("STATUS: AMBIGUOUS");
    expect(report.text).toContain(`IDEMPOTENCY KEY: ${KEY}`);
    expect(report.text).toContain(SAME_KEY_RETRY_MESSAGE);
  });

  it("REJECTED redacta CAE y certificado", async () => {
    const issueArcaInvoice = vi.fn(
      async (): Promise<IssueArcaInvoiceResult> => ({
        status: "rejected",
        emissionId: "em-1",
        voucherType: 1,
        voucherNumber: 4,
      }),
    );
    const report = await executeHomoHarness(intention, KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission: vi.fn(),
      readRejection: async () => [
        {
          code: "10016",
          message: `CAE ${CAE} -----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----`,
        },
      ],
    });

    expect(report.text).toContain("STATUS: REJECTED");
    expect(report.text).not.toContain(CAE);
    expect(report.text).not.toContain("BEGIN CERTIFICATE");
    expect(redactHarnessText(CAE)).toBe("[redactado]");
  });
});

describe("credenciales y alcance", () => {
  it("solo lee los nombres de homologación", () => {
    const reads: string[] = [];
    const env = new Proxy({} as Record<string, string | undefined>, {
      get(_target, property) {
        const name = String(property);
        reads.push(name);
        if (name.includes("PROD")) {
          throw new Error("produccion");
        }

        if (
          name === "ARCA_HOMO_CERT_B64" ||
          name === "ARCA_HOMO_PRIVATE_KEY_B64" ||
          name === "ARCA_TICKET_ENCRYPTION_KEY_B64"
        ) {
          return "presente";
        }

        return undefined;
      },
    });

    expect(() => assertHomoCredentialNamesPresent(env)).not.toThrow();
    expect(reads.some((name) => name.includes("PROD"))).toBe(false);
  });

  it("el script no emite notas ni reescribe la configuración", () => {
    const source = readFileSync("scripts/arca-homo-test-invoice.ts", "utf8");

    expect(source).toContain("executeHomoHarness");
    expect(source).toContain("issueArcaInvoice");
    expect(source).not.toContain("createInvoice");
    expect(source).not.toContain("issueArcaNote");
    expect(source).not.toContain("getOrCreate");
    expect(source).not.toContain("billingFiscalSettings.update");
    expect(source).not.toContain("requestCae");
  });

  it("la verificación no imprime el CAE", () => {
    const text = formatHomoVerify(
      {
        emissionStatus: "COMPLETED",
        emissionEnvironment: "HOMOLOGACION",
        voucherType: 1,
        voucherNumber: 4,
        invoiceId: "inv-homo",
        invoiceNumber: "0007-00000004",
        invoiceEnvironment: "HOMOLOGACION",
        fiscalStatus: "AUTORIZADA",
        caePresent: true,
      },
      {
        lastAuthorizedType1: 4,
        consultResult: "A",
        consultCaePresent: true,
        consultVoucherNumber: 4,
      },
    );

    expect(text).toContain("CAE PRESENTE: true");
    expect(text).toContain("FECompUltimoAutorizado tipo 1: 4");
    expect(text).not.toContain(CAE);
  });
});
