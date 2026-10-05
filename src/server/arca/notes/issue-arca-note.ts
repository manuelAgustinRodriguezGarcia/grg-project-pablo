import "server-only";
import type { BillingInvoiceType, BillingNoteKind } from "@/generated/prisma/client";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import type { ArcaCaeFiscalRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { getArcaCredentials } from "@/server/arca/config/credentials";
import {
  isArcaNoteProductionEmissionEnabled,
  isArcaProductionEmissionEnabled,
} from "@/server/arca/config/production-emission";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import {
  arcaEmissionLockScope,
  DuplicateArcaEmissionKeyError,
  DuplicateArcaVoucherNumberError,
  type ArcaEmissionLock,
  type ArcaEmissionRecord,
  type ArcaEmissionStore,
} from "@/server/arca/invoices/emission-store";
import { finalizeApprovedArcaNoteEmission } from "@/server/arca/notes/finalize-approved-arca-note-emission";
import type { FinalizeApprovedNoteResult } from "@/server/arca/notes/finalize-approved-arca-note-emission";
import type { ArcaNoteEmissionSource } from "@/server/arca/notes/note-emission-source";
import {
  canonicalizeArcaNotePayload,
  isArcaNoteBillingSnapshot,
  type ArcaNotePersistenceSnapshot,
} from "@/server/arca/notes/note-payload-snapshot";
import { hashArcaNoteRequest } from "@/server/arca/notes/note-request-hash";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  getIssuerFiscalConfigurationStatus,
  type IssuerFiscalConfigurationInput,
} from "@/features/billing/utils/issuer-fiscal-configuration";
import {
  creditNoteCapCents,
  invoiceOutstandingCents,
  splitGrossIvaCents,
} from "@/features/billing/utils/invoice-settlement";
import { voucherTypeForBillingNote } from "@/shared/fiscal/arca-fiscal-mapping";
import {
  NOTE_PRODUCTION_EMISSION_DISABLED_MESSAGE,
  PRODUCTION_CONFIGURATION_INCOMPLETE_MESSAGE,
  PRODUCTION_CREDENTIALS_UNAVAILABLE_MESSAGE,
  PRODUCTION_EMISSION_DISABLED_MESSAGE,
} from "@/shared/fiscal/production-emission";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import type { VoucherReconciliation } from "@/server/arca/wsfe/reconcile-voucher";
import type {
  ArcaCaeAuthorization,
  ArcaCaeRequest,
  LastAuthorizedVoucher,
} from "@/server/arca/wsfe/wsfe.types";

/**
 * Orquestador paralelo al de facturas. No modifica issueArcaInvoice.
 * El lock advisory cubre último autorizado, FECAESolicitar y el finalizador,
 * así dos NC del mismo voucherType no superan el máximo acreditable.
 * El saldo de una misma factura se serializa aparte, con FOR UPDATE, en el finalizador.
 */

const MESSAGE_MAX_LENGTH = 240;
const LOCAL_REQUEST_CODES = new Set([
  "INVALID_CAE_REQUEST",
  "INVALID_TICKET",
  "TICKET_EXPIRED",
  "INVALID_ENVIRONMENT",
]);

export type IssueArcaNoteInput = {
  kind: BillingNoteKind;
  invoiceId: string;
  amountCents: number;
  reason: string;
  idempotencyKey: string;
  createdByUserId: string;
  issuedAt?: Date | string;
};

export type IssueArcaNoteResult =
  | {
      status: "completed";
      emissionId: string;
      noteId: string;
      noteNumber: string;
      voucherType: number;
      voucherNumber: number;
      authorizationCode: string;
      authorizationExpiresAt: string | null;
      fiscalStatus: "AUTORIZADA";
      outstandingCents: number | null;
    }
  | {
      status: "rejected";
      emissionId: string;
      voucherType: number;
      voucherNumber: number;
    }
  | {
      status: "ambiguous";
      emissionId: string;
      voucherType: number;
      voucherNumber: number | null;
      code: string;
    }
  | {
      status: "failed_pre_send";
      emissionId: string;
      code: string;
      message: string;
    };

export type IssueArcaNoteDependencies = {
  store?: ArcaEmissionStore;
  lock?: ArcaEmissionLock;
  now?: Date;
  loadSource?: (invoiceId: string) => Promise<ArcaNoteEmissionSource | null>;
  finalize?: (emissionId: string) => Promise<FinalizeApprovedNoteResult>;
  getAccessTicket?: (environment: ArcaEnvironment) => Promise<ArcaAccessTicket>;
  getLastAuthorizedVoucher?: (input: {
    environment: ArcaEnvironment;
    accessTicket: ArcaAccessTicket;
    issuerCuit: string;
    pointOfSale: number;
    voucherType: number;
  }) => Promise<LastAuthorizedVoucher>;
  requestCae?: (
    input: ArcaCaeRequest & { now?: Date },
  ) => Promise<ArcaCaeAuthorization>;
  reconcile?: (input: {
    environment: ArcaEnvironment;
    issuerCuit: string;
    pointOfSale: number;
    voucherType: number;
    voucherNumber: number;
    expected: {
      documentType: number;
      documentNumber: number;
      voucherDate: string;
      totalAmount: number;
      netAmount: number;
      vatAmount: number;
      currencyId: string;
    };
  }) => Promise<VoucherReconciliation>;
};

type ResolvedDependencies = {
  store: ArcaEmissionStore;
  lock: ArcaEmissionLock;
  now: Date;
  loadSource: NonNullable<IssueArcaNoteDependencies["loadSource"]>;
  finalize: NonNullable<IssueArcaNoteDependencies["finalize"]>;
  getAccessTicket: NonNullable<IssueArcaNoteDependencies["getAccessTicket"]>;
  getLastAuthorizedVoucher: NonNullable<
    IssueArcaNoteDependencies["getLastAuthorizedVoucher"]
  >;
  requestCae: NonNullable<IssueArcaNoteDependencies["requestCae"]>;
  reconcile: NonNullable<IssueArcaNoteDependencies["reconcile"]>;
};

function validationError(message: string): BillingInvoiceError {
  return new BillingInvoiceError(message, "VALIDATION_ERROR");
}

function safeMessage(error: unknown): { code: string; message: string } {
  if (error instanceof ArcaWsfeError || (error instanceof Error && "code" in error)) {
    const code = String((error as { code?: unknown }).code ?? "UNEXPECTED");
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No se pudo emitir el comprobante.";
    return {
      code,
      message: message.replace(/\s+/g, " ").slice(0, MESSAGE_MAX_LENGTH),
    };
  }

  return { code: "UNEXPECTED", message: "No se pudo emitir el comprobante." };
}

function expirationDate(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatExpiration(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function coded(items: Array<{ code: string; message: string }>) {
  return items.map((item) => ({ code: item.code, message: item.message }));
}

function assertIdempotencyKey(value: string): string {
  const key = value.trim();

  if (!key || key.length > 128) {
    throw new ArcaEmissionError(
      "La clave de idempotencia no es válida.",
      "ARCA_IDEMPOTENCY_CONFLICT",
    );
  }

  return key;
}

function assertSameHash(emission: ArcaEmissionRecord, requestHash: string): void {
  if (emission.requestHash !== requestHash) {
    throw new ArcaEmissionError(
      "La clave de idempotencia ya se usó con otros datos.",
      "ARCA_IDEMPOTENCY_CONFLICT",
    );
  }
}

function assertProductionReady(source: ArcaNoteEmissionSource): void {
  if (source.invoice.environment !== "PRODUCCION") {
    return;
  }

  if (!isArcaProductionEmissionEnabled()) {
    throw new BillingInvoiceError(
      PRODUCTION_EMISSION_DISABLED_MESSAGE,
      "PRODUCTION_EMISSION_DISABLED",
    );
  }

  assertNoteProductionRollout();

  const readiness = getIssuerFiscalConfigurationStatus(source.issuer);

  if (!readiness.complete) {
    throw new BillingInvoiceError(
      PRODUCTION_CONFIGURATION_INCOMPLETE_MESSAGE,
      "ARCA_PRODUCTION_CONFIGURATION_INCOMPLETE",
    );
  }

  try {
    getArcaCredentials("PRODUCCION");
  } catch (error) {
    if (error instanceof ArcaConfigurationError) {
      throw new BillingInvoiceError(
        PRODUCTION_CREDENTIALS_UNAVAILABLE_MESSAGE,
        "ARCA_CONFIGURATION_ERROR",
      );
    }

    throw error;
  }
}

function assertUnsentProductionAllowed(environment: ArcaEnvironment): void {
  if (environment !== "PRODUCCION") {
    return;
  }

  if (!isArcaProductionEmissionEnabled()) {
    throw new BillingInvoiceError(
      PRODUCTION_EMISSION_DISABLED_MESSAGE,
      "PRODUCTION_EMISSION_DISABLED",
    );
  }

  assertNoteProductionRollout();

  try {
    getArcaCredentials("PRODUCCION");
  } catch (error) {
    if (error instanceof ArcaConfigurationError) {
      throw new BillingInvoiceError(
        PRODUCTION_CREDENTIALS_UNAVAILABLE_MESSAGE,
        "ARCA_CONFIGURATION_ERROR",
      );
    }

    throw error;
  }
}

function assertNoteProductionRollout(): void {
  if (isArcaNoteProductionEmissionEnabled()) {
    return;
  }

  throw new BillingInvoiceError(
    NOTE_PRODUCTION_EMISSION_DISABLED_MESSAGE,
    "NOTE_PRODUCTION_EMISSION_DISABLED",
  );
}

function assertFiscalInvoice(source: ArcaNoteEmissionSource): void {
  if (source.settingsEnvironment !== source.invoice.environment) {
    throw validationError(
      "El ambiente fiscal vigente no coincide con el de la factura.",
    );
  }

  assertAssociatedInvoice(source.invoice);
}

function assertAssociatedInvoice(invoice: ArcaNoteEmissionSource["invoice"]): void {
  switch (invoice.environment) {
    case "HOMOLOGACION":
    case "PRODUCCION":
      break;
    case "MODO_PRUEBA":
      throw validationError(
        "Las notas fiscales solo pueden aplicarse a facturas de homologación o producción.",
      );
    default: {
      const unexpected: never = invoice.environment;
      throw unexpected;
    }
  }

  if (invoice.fiscalStatus !== "AUTORIZADA" || !invoice.cae?.trim()) {
    throw validationError("La factura asociada no está autorizada por ARCA.");
  }

  parseArcaPointOfSale(invoice.pointOfSale);

  if (!Number.isSafeInteger(invoice.sequenceNumber) || invoice.sequenceNumber <= 0) {
    throw validationError("La factura asociada no tiene número fiscal.");
  }

  switch (invoice.invoiceType) {
    case "A":
    case "B":
      break;
    default: {
      const unexpected: never = invoice.invoiceType;
      throw unexpected;
    }
  }
}

export function assertCommercialLimits(
  source: ArcaNoteEmissionSource,
  kind: BillingNoteKind,
  amountCents: number,
): void {
  const invoice = source.invoice;

  if (kind === "CREDIT") {
    const cap = creditNoteCapCents(
      invoice.totalVisualRoundedCents,
      source.authorizedCreditCents,
      source.authorizedDebitCents,
    );

    if (cap <= 0 || amountCents > cap) {
      throw validationError(
        "Esta factura no tiene importe disponible para una nota de crédito.",
      );
    }

    return;
  }

  if (kind === "DEBIT") {
    const outstanding = invoiceOutstandingCents(
      invoice.totalVisualRoundedCents,
      source.authorizedCreditCents,
      source.authorizedDebitCents,
      source.allocatedCents,
    );

    if (
      invoice.paymentMethod !== "CUENTA_CORRIENTE" ||
      invoice.paymentStatus === "PAGA" ||
      invoice.paymentStatus === "ANULADA" ||
      outstanding <= 0
    ) {
      throw validationError(
        "La nota de débito solo aplica a facturas de cuenta corriente con saldo pendiente.",
      );
    }

    return;
  }

  const unexpected: never = kind;
  throw unexpected;
}

function persistedIssuer(
  snapshot: ArcaNotePersistenceSnapshot,
): IssuerFiscalConfigurationInput {
  const issuer = snapshot.issuerSnapshot;

  if (!issuer?.name.trim() || !issuer.cuit.trim()) {
    throw new ArcaEmissionError(
      "Falta el snapshot comercial de la nota.",
      "ARCA_APPROVED_EMISSION_INCOMPLETE",
    );
  }

  return {
    issuerName: issuer.name,
    issuerCuit: issuer.cuit,
    issuerAddress: issuer.address,
    issuerCity: issuer.city,
    issuerProvince: issuer.province,
    issuerIvaCondition: issuer.ivaCondition,
    issuerGrossIncome: issuer.grossIncome,
    issuerActivitiesStartedAt: issuer.activitiesStartedAt,
    pointOfSale: snapshot.associatedInvoice.pointOfSale,
  };
}

function snapshotFromSource(
  input: IssueArcaNoteInput,
  source: ArcaNoteEmissionSource,
  issuedAt: Date,
  issuer: IssuerFiscalConfigurationInput = source.issuer,
): ArcaNotePersistenceSnapshot {
  const split = splitGrossIvaCents(input.amountCents, source.invoice.ivaPercent);

  try {
    return canonicalizeArcaNotePayload({
      kind: input.kind,
      invoiceId: source.invoice.id,
      reason: input.reason,
      amountCents: input.amountCents,
      netAmountCents: split.netCents,
      ivaAmountCents: split.ivaCents,
      ivaPercent: source.invoice.ivaPercent,
      createdByUserId: input.createdByUserId,
      issuedAt: issuedAt.toISOString(),
      client: source.invoice.client,
      associatedInvoice: {
        environment: source.invoice.environment,
        invoiceType: source.invoice.invoiceType,
        pointOfSale: source.invoice.pointOfSale,
        sequenceNumber: source.invoice.sequenceNumber,
        issuedAt: source.invoice.issuedAt.toISOString(),
        cae: source.invoice.cae ?? "",
        totalVisualRoundedCents: source.invoice.totalVisualRoundedCents,
      },
      issuer,
    });
  } catch (error) {
    throw validationError(
      error instanceof Error ? error.message : "La nota no es válida.",
    );
  }
}

function requireNoteSnapshot(emission: ArcaEmissionRecord): ArcaNotePersistenceSnapshot {
  const snapshot = emission.billingPayloadSnapshot;

  if (!snapshot || !isArcaNoteBillingSnapshot(snapshot)) {
    throw new ArcaEmissionError(
      "Falta el snapshot comercial de la nota.",
      "ARCA_APPROVED_EMISSION_INCOMPLETE",
    );
  }

  return snapshot;
}

function fiscalRequestFor(
  emission: ArcaEmissionRecord,
  snapshot: ArcaNotePersistenceSnapshot,
  voucherNumber: number,
): ArcaCaeFiscalRequest {
  return buildArcaNoteCaeRequest({
    kind: snapshot.kind,
    invoiceType: snapshot.associatedInvoice.invoiceType,
    amountCents: snapshot.amountCents,
    netAmountCents: snapshot.netAmountCents,
    ivaAmountCents: snapshot.ivaAmountCents,
    ivaPercent: Number(snapshot.ivaPercent),
    issuedAt: snapshot.issuedAt,
    receptor: {
      identificationType: snapshot.client.identificationType,
      identificationNumber: snapshot.client.identificationNumber,
      ivaCondition: snapshot.client.ivaCondition,
    },
    associatedInvoice: {
      invoiceType: snapshot.associatedInvoice.invoiceType,
      pointOfSale: snapshot.associatedInvoice.pointOfSale,
      sequenceNumber: snapshot.associatedInvoice.sequenceNumber,
      issuedAt: snapshot.associatedInvoice.issuedAt,
      environment: snapshot.associatedInvoice.environment,
      fiscalStatus: "AUTORIZADA",
      cae: snapshot.associatedInvoice.cae,
    },
    environment: snapshot.associatedInvoice.environment,
    issuerCuit: emission.issuerCuit,
    voucherNumber,
  });
}

async function resolveDependencies(
  dependencies: IssueArcaNoteDependencies,
): Promise<ResolvedDependencies> {
  const store =
    dependencies.store ??
    (await import("@/server/arca/repositories/arca-emission.repository")).arcaEmissionRepository;
  const lock =
    dependencies.lock ??
    (await import("@/server/arca/invoices/emission-lock")).withArcaEmissionLock;
  const loadSource =
    dependencies.loadSource ??
    (await import("@/server/arca/notes/note-emission-source")).loadArcaNoteEmissionSource;
  const finalize = dependencies.finalize ?? finalizeApprovedArcaNoteEmission;
  const getAccessTicket =
    dependencies.getAccessTicket ??
    (await import("@/server/arca/tickets/access-ticket")).getValidArcaAccessTicket;
  const getLastAuthorizedVoucher =
    dependencies.getLastAuthorizedVoucher ??
    (await import("@/server/arca/wsfe/wsfe-client")).getLastAuthorizedVoucher;
  const requestCae =
    dependencies.requestCae ??
    (await import("@/server/arca/wsfe/wsfe-client")).requestCae;
  const reconcile =
    dependencies.reconcile ??
    (await import("@/server/arca/wsfe/reconcile-voucher"))
      .reconcileVoucherAfterAmbiguousEmission;

  return {
    store,
    lock,
    now: dependencies.now ?? new Date(),
    loadSource,
    finalize,
    getAccessTicket,
    getLastAuthorizedVoucher,
    requestCae,
    reconcile,
  };
}

async function loadOrCreate(
  store: ArcaEmissionStore,
  data: {
    idempotencyKey: string;
    requestHash: string;
    environment: ArcaEnvironment;
    issuerCuit: string;
    pointOfSale: number;
    invoiceType: BillingInvoiceType;
    voucherType: number;
    billingPayloadSnapshot: ArcaNotePersistenceSnapshot;
  },
): Promise<ArcaEmissionRecord> {
  const existing = await store.findByIdempotencyKey(data.idempotencyKey);

  if (existing) {
    assertSameHash(existing, data.requestHash);
    return existing;
  }

  try {
    return await store.createPrepared(data);
  } catch (error) {
    if (!(error instanceof DuplicateArcaEmissionKeyError)) {
      throw error;
    }

    const raced = await store.findByIdempotencyKey(data.idempotencyKey);

    if (!raced) {
      throw error;
    }

    assertSameHash(raced, data.requestHash);
    return raced;
  }
}

function completedResult(
  emissionId: string,
  finalized: FinalizeApprovedNoteResult,
): IssueArcaNoteResult {
  return {
    status: "completed",
    emissionId,
    noteId: finalized.note.id,
    noteNumber: finalized.note.noteNumber,
    voucherType: finalized.note.voucherType,
    voucherNumber: finalized.note.sequenceNumber,
    authorizationCode: finalized.note.cae,
    authorizationExpiresAt: formatExpiration(new Date(finalized.note.caeExpiresAt)),
    fiscalStatus: "AUTORIZADA",
    outstandingCents: finalized.note.settlement?.outstandingCents ?? null,
  };
}

export async function issueArcaNote(
  input: IssueArcaNoteInput,
  dependencies: IssueArcaNoteDependencies = {},
): Promise<IssueArcaNoteResult> {
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);

  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw validationError("El importe tiene que ser mayor a cero.");
  }

  if (!input.invoiceId.trim() || !input.createdByUserId.trim()) {
    throw validationError("La nota no tiene factura o usuario.");
  }

  const resolved = await resolveDependencies(dependencies);
  const existing = await resolved.store.findByIdempotencyKey(idempotencyKey);

  if (existing) {
    return retryExisting(input, existing, resolved);
  }

  const source = await resolved.loadSource(input.invoiceId);

  if (!source) {
    throw new BillingInvoiceError("Factura no encontrada.", "BILLING_INVOICE_NOT_FOUND");
  }

  assertFiscalInvoice(source);
  assertProductionReady(source);
  assertCommercialLimits(source, input.kind, input.amountCents);
  const issuedAt = input.issuedAt ? new Date(input.issuedAt) : resolved.now;
  const snapshot = snapshotFromSource(input, source, issuedAt);
  const issuerCuit = normalizeIssuerCuit(source.issuerCuit);
  const pointOfSale = parseArcaPointOfSale(snapshot.associatedInvoice.pointOfSale);
  const voucherType = voucherTypeForBillingNote(
    snapshot.kind,
    snapshot.associatedInvoice.invoiceType,
  );
  const requestHash = hashArcaNoteRequest({ issuerCuit, snapshot });
  const emission = await loadOrCreate(resolved.store, {
    idempotencyKey,
    requestHash,
    environment: snapshot.associatedInvoice.environment,
    issuerCuit,
    pointOfSale,
    invoiceType: snapshot.associatedInvoice.invoiceType,
    voucherType,
    billingPayloadSnapshot: snapshot,
  });

  return lockAndResume(emission, snapshot.associatedInvoice.environment, pointOfSale, voucherType, requestHash, resolved);
}

async function retryExisting(
  input: IssueArcaNoteInput,
  existing: ArcaEmissionRecord,
  resolved: ResolvedDependencies,
): Promise<IssueArcaNoteResult> {
  const source = await resolved.loadSource(input.invoiceId);

  if (!source) {
    throw new BillingInvoiceError("Factura no encontrada.", "BILLING_INVOICE_NOT_FOUND");
  }

  const persisted = requireNoteSnapshot(existing);
  const issuedAt = input.issuedAt ? new Date(input.issuedAt) : resolved.now;
  const snapshot = snapshotFromSource(
    input,
    source,
    issuedAt,
    persistedIssuer(persisted),
  );
  const requestHash = hashArcaNoteRequest({
    issuerCuit: existing.issuerCuit,
    snapshot,
  });
  assertSameHash(existing, requestHash);

  return lockAndResume(
    existing,
    existing.environment,
    existing.pointOfSale,
    existing.voucherType,
    requestHash,
    resolved,
  );
}

function lockAndResume(
  emission: ArcaEmissionRecord,
  environment: ArcaEnvironment,
  pointOfSale: number,
  voucherType: number,
  requestHash: string,
  resolved: ResolvedDependencies,
): Promise<IssueArcaNoteResult> {
  return resolved.lock(
    arcaEmissionLockScope(environment, pointOfSale, voucherType),
    async () => {
      const current = await resolved.store.findById(emission.id);

      if (!current) {
        throw new Error("La emisión no existe.");
      }

      assertSameHash(current, requestHash);
      return resume(current, resolved);
    },
  );
}

async function resume(
  emission: ArcaEmissionRecord,
  dependencies: ResolvedDependencies,
): Promise<IssueArcaNoteResult> {
  switch (emission.status) {
    case "COMPLETED":
    case "APPROVED_PENDING_PERSISTENCE":
      return completedResult(emission.id, await dependencies.finalize(emission.id));
    case "REJECTED":
      return {
        status: "rejected",
        emissionId: emission.id,
        voucherType: emission.voucherType,
        voucherNumber: emission.voucherNumber ?? 0,
      };
    case "AMBIGUOUS":
      return reconcileExisting(emission, dependencies);
    case "SENDING":
      if (emission.voucherNumber === null) {
        return emitNew(emission, dependencies);
      }
      return reconcileExisting(emission, dependencies);
    case "PREPARED":
    case "FAILED_PRE_SEND":
      return emitNew(emission, dependencies);
    default: {
      const unexpected: never = emission.status;
      return unexpected;
    }
  }
}

async function failPreSend(
  store: ArcaEmissionStore,
  id: string,
  code: string,
  message: string,
  clearVoucherNumber = false,
): Promise<IssueArcaNoteResult> {
  const updated = await store.markFailedPreSend(id, {
    code,
    message,
    clearVoucherNumber,
  });

  return {
    status: "failed_pre_send",
    emissionId: updated.id,
    code,
    message,
  };
}

function rethrowProductionBlock(error: unknown): void {
  if (!(error instanceof BillingInvoiceError)) {
    return;
  }

  switch (error.code) {
    case "PRODUCTION_EMISSION_DISABLED":
    case "NOTE_PRODUCTION_EMISSION_DISABLED":
    case "ARCA_PRODUCTION_CONFIGURATION_INCOMPLETE":
    case "ARCA_CONFIGURATION_ERROR":
      throw error;
    default:
      return;
  }
}

async function emitNew(
  emission: ArcaEmissionRecord,
  dependencies: ResolvedDependencies,
): Promise<IssueArcaNoteResult> {
  const snapshot = requireNoteSnapshot(emission);
  let fiscalRequest: ArcaCaeFiscalRequest;
  let ticket: ArcaAccessTicket;

  try {
    const fresh = await dependencies.loadSource(snapshot.invoiceId);

    if (!fresh) {
      throw validationError("Factura no encontrada.");
    }

    assertAssociatedInvoice(fresh.invoice);
    assertUnsentProductionAllowed(emission.environment);
    assertCommercialLimits(fresh, snapshot.kind, snapshot.amountCents);
    ticket = await dependencies.getAccessTicket(emission.environment);
    const last = await dependencies.getLastAuthorizedVoucher({
      environment: emission.environment,
      accessTicket: ticket,
      issuerCuit: emission.issuerCuit,
      pointOfSale: emission.pointOfSale,
      voucherType: emission.voucherType,
    });
    fiscalRequest = fiscalRequestFor(emission, snapshot, last.lastNumber + 1);
  } catch (error) {
    rethrowProductionBlock(error);
    const safe = safeMessage(error);
    return failPreSend(dependencies.store, emission.id, safe.code, safe.message);
  }

  try {
    await dependencies.store.updateSending(emission.id, {
      voucherNumber: fiscalRequest.voucherFrom,
      voucherType: fiscalRequest.voucherType,
      fiscalRequestSnapshot: fiscalRequest,
    });
  } catch (error) {
    if (error instanceof DuplicateArcaVoucherNumberError) {
      return failPreSend(
        dependencies.store,
        emission.id,
        error.code,
        error.message,
      );
    }

    throw error;
  }

  let authorization: ArcaCaeAuthorization;

  try {
    authorization = await dependencies.requestCae({
      ...fiscalRequest,
      accessTicket: ticket,
    });
  } catch (error) {
    const safe = safeMessage(error);

    if (LOCAL_REQUEST_CODES.has(safe.code)) {
      return failPreSend(
        dependencies.store,
        emission.id,
        safe.code,
        safe.message,
        true,
      );
    }

    const ambiguous = await dependencies.store.markAmbiguous(emission.id, safe);
    return {
      status: "ambiguous",
      emissionId: ambiguous.id,
      voucherType: fiscalRequest.voucherType,
      voucherNumber: fiscalRequest.voucherFrom,
      code: safe.code,
    };
  }

  if (authorization.status === "rejected") {
    const rejected = await dependencies.store.markRejected(emission.id, {
      observations: coded(authorization.observations),
      errors: coded(authorization.errors),
      events: coded(authorization.events),
    });
    return {
      status: "rejected",
      emissionId: rejected.id,
      voucherType: rejected.voucherType,
      voucherNumber: rejected.voucherNumber ?? fiscalRequest.voucherFrom,
    };
  }

  await dependencies.store.markApproved(emission.id, {
    authorizationCode: authorization.cae,
    authorizationExpiresAt: expirationDate(authorization.caeExpirationDate),
    arcaProcessDate: authorization.header.processDate,
    reprocess: authorization.header.reprocess,
    observations: coded(authorization.observations),
    events: coded(authorization.events),
  });

  return completedResult(emission.id, await dependencies.finalize(emission.id));
}

async function reconcileExisting(
  emission: ArcaEmissionRecord,
  dependencies: ResolvedDependencies,
): Promise<IssueArcaNoteResult> {
  const fiscal = emission.fiscalRequestSnapshot;
  const voucherNumber = emission.voucherNumber;

  if (!fiscal || voucherNumber === null) {
    await dependencies.store.markAmbiguous(emission.id, {
      code: "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND",
      message: "No hay un comprobante persistido para reconciliar.",
    });
    throw new ArcaEmissionError(
      "No hay un comprobante persistido para reconciliar.",
      "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND",
    );
  }

  const reconciliation = await dependencies.reconcile({
    environment: emission.environment,
    issuerCuit: emission.issuerCuit,
    pointOfSale: emission.pointOfSale,
    voucherType: emission.voucherType,
    voucherNumber,
    expected: {
      documentType: fiscal.documentType,
      documentNumber: fiscal.documentNumber,
      voucherDate: fiscal.voucherDate,
      totalAmount: fiscal.totalAmount,
      netAmount: fiscal.netAmount,
      vatAmount: fiscal.vatAmount,
      currencyId: fiscal.currencyId,
    },
  });

  if (reconciliation.status === "authorized") {
    await dependencies.store.markApproved(emission.id, {
      authorizationCode: reconciliation.authorizationCode,
      authorizationExpiresAt: expirationDate(reconciliation.expirationDate),
      arcaProcessDate: null,
      reprocess: null,
      observations: [],
      events: [],
    });
    return completedResult(emission.id, await dependencies.finalize(emission.id));
  }

  if (reconciliation.status === "mismatch") {
    await dependencies.store.markAmbiguous(emission.id, {
      code: "ARCA_AMBIGUOUS_VOUCHER_MISMATCH",
      message: "El comprobante consultado no coincide con la emisión pendiente.",
    });
    throw new ArcaEmissionError(
      "El comprobante consultado no coincide con la emisión pendiente.",
      "ARCA_AMBIGUOUS_VOUCHER_MISMATCH",
    );
  }

  await dependencies.store.markAmbiguous(emission.id, {
    code: "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND",
    message: "ARCA no tiene el comprobante de la emisión pendiente.",
  });
  throw new ArcaEmissionError(
    "ARCA no tiene el comprobante de la emisión pendiente.",
    "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND",
  );
}
