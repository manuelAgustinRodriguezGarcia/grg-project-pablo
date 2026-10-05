import { afterEach, describe, expect, it } from "vitest";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { getArcaCertificate } from "@/server/arca/config/credentials";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { fingerprintArcaCertificate } from "@/server/arca/tickets/certificate-fingerprint";
import {
  decryptArcaTicket,
  readTicketEncryptionKey,
} from "@/server/arca/tickets/ticket-encryption";
import { arcaTicketContext } from "@/server/arca/tickets/ticket.types";
import { requestWsaaTicket } from "@/server/arca/wsaa/wsaa-client";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { getLastAuthorizedVoucher } from "@/server/arca/wsfe/wsfe-client";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import {
  creditNoteCapCents,
  splitGrossIvaCents,
} from "@/features/billing/utils/invoice-settlement";
import { voucherTypeForBillingNote } from "@/shared/fiscal/arca-fiscal-mapping";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { loadNextLocalEnv } from "./load-next-env";

const ENVIRONMENT = "HOMOLOGACION" as const;
const FISCAL_SETTINGS_ID = "fiscal-settings";
const SAMPLE_REASON = "PRUEBA HOMOLOGACION NC";
const VOUCHERS = [
  { type: 1, label: "Factura A (1)" },
  { type: 2, label: "ND A (2)" },
  { type: 3, label: "NC A (3)" },
  { type: 6, label: "Factura B (6)" },
  { type: 7, label: "ND B (7)" },
  { type: 8, label: "NC B (8)" },
] as const;

type Snapshot = {
  invoices: number;
  notes: number;
  emissions: number;
  receipts: number;
  settingsEnvironment: string | null;
  settingsUpdatedAt: string | null;
};

function assertHomologacionOnly(environment: string): asserts environment is "HOMOLOGACION" {
  if (environment !== "HOMOLOGACION") {
    throw new Error(
      "Este preflight rechaza PRODUCCION y cualquier ambiente distinto de HOMOLOGACION.",
    );
  }
}

function sanitizeDiagnostic(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]")
    .replace(/token[=:]\s*\S+/gi, "token=[redacted]")
    .replace(/sign[=:]\s*\S+/gi, "sign=[redacted]")
    .slice(0, 240);
}

function installReadOnlyGuard(): () => void {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? init.body : "";

    if (body.includes("FECAESolicitar")) {
      throw new Error("FECAESolicitar está bloqueado en este preflight.");
    }

    const homologacion =
      url.includes("wsaahomo.afip.gov.ar") || url.includes("wswhomo.afip.gob.ar");

    if (!homologacion) {
      throw new Error("Este preflight bloqueó una URL que no es de homologación.");
    }

    return originalFetch(input, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function database() {
  const { prisma } = await import("@/server/database/prisma");
  return prisma;
}

async function readSnapshot(): Promise<Snapshot> {
  const prisma = await database();
  const [invoices, notes, emissions, receipts, settings] = await Promise.all([
    prisma.billingInvoice.count(),
    prisma.billingNote.count(),
    prisma.billingArcaEmission.count(),
    prisma.billingReceipt.count(),
    prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: { environment: true, updatedAt: true, pointOfSale: true, issuerCuit: true },
    }),
  ]);

  return {
    invoices,
    notes,
    emissions,
    receipts,
    settingsEnvironment: settings?.environment ?? null,
    settingsUpdatedAt: settings?.updatedAt.toISOString() ?? null,
  };
}

async function readCachedHomoTicket(): Promise<ArcaAccessTicket | null> {
  assertHomologacionOnly(ENVIRONMENT);
  const endpoints = resolveArcaEndpoints(ENVIRONMENT);
  const certificatePem = getArcaCertificate(ENVIRONMENT);
  const identity = {
    environment: ENVIRONMENT,
    service: endpoints.service,
    certificateFingerprint: fingerprintArcaCertificate(certificatePem),
  };
  const { arcaAccessTicketRepository } = await import(
    "@/server/repositories/arca-access-ticket.repository"
  );
  const row = await arcaAccessTicketRepository.findTicket(identity);

  if (!row) {
    return null;
  }

  const secrets = decryptArcaTicket({
    encryptedPayload: row.encryptedPayload,
    iv: row.iv,
    authTag: row.authTag,
    aad: arcaTicketContext(identity),
    key: readTicketEncryptionKey(),
  });

  return {
    token: secrets.token,
    sign: secrets.sign,
    generationTime: row.generationTime,
    expirationTime: row.expirationTime,
    service: row.service,
    environment: ENVIRONMENT,
  };
}

function ticketIsPresent(ticket: ArcaAccessTicket, now: Date): boolean {
  return (
    ticket.environment === "HOMOLOGACION" &&
    ticket.service === "wsfe" &&
    ticket.token.trim().length > 0 &&
    ticket.sign.trim().length > 0 &&
    ticket.expirationTime.getTime() > now.getTime()
  );
}

describe("preflight live de notas en homologación", () => {
  let restoreFetch: (() => void) | null = null;

  afterEach(() => {
    restoreFetch?.();
    restoreFetch = null;
  });

  it("consulta WSAA y WSFE sin emitir ni escribir facturación", async () => {
    assertHomologacionOnly(ENVIRONMENT);
    loadNextLocalEnv();
    restoreFetch = installReadOnlyGuard();
    const prisma = await database();

    const before = await readSnapshot();
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: { issuerCuit: true, pointOfSale: true, environment: true },
    });
    const issuerCuit = normalizeIssuerCuit(settings?.issuerCuit);
    const pointOfSale = parseArcaPointOfSale(settings?.pointOfSale ?? "");
    const lines: string[] = [];
    const now = new Date();
    let wsaaOk = false;
    let wsfeOk = false;
    let fecaSolicitarCalled = false;
    const lastByType = new Map<number, number>();

    try {
      let ticket: ArcaAccessTicket | null = null;

      try {
        ticket = await requestWsaaTicket(ENVIRONMENT);
      } catch (error) {
        const alreadyAuthenticated =
          error instanceof ArcaWsaaError &&
          (error.faultCode?.includes("coe.alreadyAuthenticated") ?? false);

        if (!alreadyAuthenticated) {
          throw error;
        }

        ticket = await readCachedHomoTicket();
        if (!ticket) {
          throw new Error(
            "WSAA respondió que ya hay un ticket vigente y el cache local no tiene uno usable.",
          );
        }
      }

      wsaaOk = ticketIsPresent(ticket, now);
      if (!wsaaOk) {
        throw new Error("El ticket de homologación no está vigente.");
      }

      lines.push("A. WSAA HOMO");
      lines.push("OK");
      lines.push(`environment: ${ticket.environment}`);
      lines.push("token presente: sí");
      lines.push("sign presente: sí");
      lines.push(`expirationTime: ${ticket.expirationTime.toISOString()}`);

      lines.push("");
      lines.push("B. WSFE HOMO");

      for (const voucher of VOUCHERS) {
        const last = await getLastAuthorizedVoucher({
          environment: ENVIRONMENT,
          accessTicket: ticket,
          issuerCuit,
          pointOfSale,
          voucherType: voucher.type,
        });

        if (last.voucherType !== voucher.type || last.pointOfSale !== pointOfSale) {
          throw new Error("WSFE devolvió un tipo o punto de venta distinto del consultado.");
        }

        lastByType.set(voucher.type, last.lastNumber);
      }

      wsfeOk = true;
      lines.push("OK");
      lines.push("");
      lines.push("C. Últimos números:");
      for (const voucher of VOUCHERS) {
        lines.push(`${voucher.label}: ${lastByType.get(voucher.type)}`);
      }
    } catch (error) {
      if (!lines.some((line) => line.startsWith("A. WSAA"))) {
        lines.push("A. WSAA HOMO");
        lines.push("ERROR");
        lines.push(sanitizeDiagnostic(error instanceof Error ? error.message : "inesperado"));
      } else if (!wsfeOk) {
        lines.push("ERROR");
        lines.push(
          sanitizeDiagnostic(
            error instanceof ArcaWsfeError
              ? `${error.code} ${error.faultCode ?? ""}`.trim()
              : error instanceof Error
                ? error.message
                : "inesperado",
          ),
        );
      }

      console.log(lines.join("\n"));
      throw new Error(lines.join("\n"));
    }

    const candidates = await (await database()).billingInvoice.findMany({
      where: {
        environment: "HOMOLOGACION",
        fiscalStatus: "AUTORIZADA",
        cae: { not: null },
        sequenceNumber: { gt: 0 },
        invoiceType: { in: ["A", "B"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        pointOfSale: true,
        sequenceNumber: true,
        issuedAt: true,
        total: true,
        ivaPercent: true,
        clientName: true,
        clientIdentificationType: true,
        clientIdentificationNumber: true,
        clientIvaCondition: true,
        cae: true,
      },
      orderBy: [{ issuedAt: "desc" }],
    });

    const usable = candidates.filter((invoice) => {
      if (!invoice.cae?.trim()) {
        return false;
      }

      try {
        parseArcaPointOfSale(invoice.pointOfSale);
        return true;
      } catch {
        return false;
      }
    });

    const noteSums =
      usable.length === 0
        ? []
        : await (await database()).billingNote.groupBy({
            by: ["invoiceId", "kind"],
            where: {
              invoiceId: { in: usable.map((invoice) => invoice.id) },
              fiscalStatus: "AUTORIZADA",
            },
            _sum: { amount: true },
          });

    function capCents(invoiceId: string, total: { toNumber(): number }): number {
      const credit = noteSums
        .filter((row) => row.invoiceId === invoiceId && row.kind === "CREDIT")
        .reduce((sum, row) => sum + pesosToCents(row._sum.amount?.toNumber() ?? 0), 0);
      const debit = noteSums
        .filter((row) => row.invoiceId === invoiceId && row.kind === "DEBIT")
        .reduce((sum, row) => sum + pesosToCents(row._sum.amount?.toNumber() ?? 0), 0);

      return creditNoteCapCents(pesosToCents(total.toNumber()), credit, debit);
    }

    lines.push("");
    lines.push("D. Facturas HOMOLOGACION candidatas locales:");
    lines.push(`cantidad: ${usable.length}`);

    for (const invoice of usable) {
      lines.push(
        [
          invoice.invoiceNumber,
          `letra ${invoice.invoiceType}`,
          invoice.issuedAt.toISOString().slice(0, 10),
          `total ${invoice.total.toFixed(2)}`,
          invoice.clientName,
          `CAE presente: ${invoice.cae?.trim() ? "sí" : "no"}`,
        ].join(" | "),
      );
    }

    const ranked = [...usable].sort((left, right) => {
      if (left.invoiceType !== right.invoiceType) {
        return left.invoiceType === "B" ? -1 : 1;
      }

      return right.issuedAt.getTime() - left.issuedAt.getTime();
    });
    const candidate =
      ranked.find((invoice) => capCents(invoice.id, invoice.total) > 0) ?? null;

    lines.push("");
    lines.push("E. Dry-run del request:");

    if (!candidate) {
      lines.push("NO HAY FACTURA LOCAL DE HOMOLOGACION DISPONIBLE PARA ASOCIAR UNA NC/ND.");
    } else {
      const amountCents = Math.min(100, capCents(candidate.id, candidate.total));
      const { netCents, ivaCents } = splitGrossIvaCents(
        amountCents,
        candidate.ivaPercent.toNumber(),
      );
      const noteVoucherType = voucherTypeForBillingNote("CREDIT", candidate.invoiceType);
      const nextNumber = (lastByType.get(noteVoucherType) ?? 0) + 1;
      let request: ReturnType<typeof buildArcaNoteCaeRequest> | null = null;

      try {
        request = buildArcaNoteCaeRequest({
        kind: "CREDIT",
        invoiceType: candidate.invoiceType,
        amountCents,
        netAmountCents: netCents,
        ivaAmountCents: ivaCents,
        ivaPercent: candidate.ivaPercent.toNumber(),
        issuedAt: now,
        receptor: {
          identificationType: candidate.clientIdentificationType,
          identificationNumber: candidate.clientIdentificationNumber,
          ivaCondition: candidate.clientIvaCondition,
        },
        associatedInvoice: {
          invoiceType: candidate.invoiceType,
          pointOfSale: candidate.pointOfSale,
          sequenceNumber: candidate.sequenceNumber,
          issuedAt: candidate.issuedAt,
          environment: "HOMOLOGACION",
          fiscalStatus: "AUTORIZADA",
          cae: candidate.cae,
        },
        environment: ENVIRONMENT,
        issuerCuit,
          voucherNumber: nextNumber,
        });
      } catch (error) {
        lines.push("ERROR al construir el request local.");
        lines.push(sanitizeDiagnostic(error instanceof Error ? error.message : "inesperado"));
      }

      if (request) {
        const associated = request.associatedVouchers?.[0];

        expect(request.environment).toBe("HOMOLOGACION");
        expect(request.voucherType).toBe(candidate.invoiceType === "B" ? 8 : 3);
        expect(associated?.type).toBe(candidate.invoiceType === "B" ? 6 : 1);
        expect(associated?.pointOfSale).toBe(parseArcaPointOfSale(candidate.pointOfSale));
        expect(associated?.number).toBe(candidate.sequenceNumber);
        expect(associated?.issuedAt).toBe(formatArcaVoucherDate(candidate.issuedAt));
        expect(request.voucherFrom).toBe(nextNumber);
        expect(JSON.stringify(request)).not.toContain(candidate.cae ?? "___cae___");

        lines.push(`motivo de la intención: ${SAMPLE_REASON}`);
        lines.push(`voucherType de nota: ${request.voucherType}`);
        lines.push(`próximo número simulado: ${request.voucherFrom}`);
        lines.push(`tipo del comprobante asociado: ${associated?.type}`);
        lines.push(`punto de venta asociado: ${associated?.pointOfSale}`);
        lines.push(`número asociado: ${associated?.number}`);
        lines.push(`importe: ${(amountCents / 100).toFixed(2)}`);
      }
    }

    const after = await readSnapshot();
    const billingUnchanged =
      before.invoices === after.invoices &&
      before.notes === after.notes &&
      before.emissions === after.emissions &&
      before.receipts === after.receipts &&
      before.settingsEnvironment === after.settingsEnvironment &&
      before.settingsUpdatedAt === after.settingsUpdatedAt;

    lines.push("");
    lines.push("F. Confirmación:");
    lines.push(`FECAESolicitar NO fue llamado: ${fecaSolicitarCalled ? "no" : "sí"}`);
    lines.push(
      `no hubo escrituras de facturación en base: ${billingUnchanged ? "sí" : "no"}`,
    );
    lines.push("PRODUCCION NO fue consultada: sí");
    lines.push(
      `BillingFiscalSettings NO fue modificada: ${
        before.settingsUpdatedAt === after.settingsUpdatedAt &&
        before.settingsEnvironment === after.settingsEnvironment
          ? "sí"
          : "no"
      }`,
    );

    console.log(lines.join("\n"));

    expect(wsaaOk).toBe(true);
    expect(wsfeOk).toBe(true);
    expect(fecaSolicitarCalled).toBe(false);
    expect(billingUnchanged).toBe(true);
    expect(after.settingsEnvironment).toBe(before.settingsEnvironment);
  }, 120000);
});
