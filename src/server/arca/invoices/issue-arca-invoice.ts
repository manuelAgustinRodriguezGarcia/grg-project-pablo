import "server-only";
import type { BillingInvoiceType } from "@/generated/prisma/client";
import {
  buildArcaCaeRequest,
  formatArcaVoucherDate,
  type ArcaCaeFiscalRequest,
} from "@/server/arca/adapters/billing-invoice-to-cae";
import { isArcaProductionEmissionEnabled } from "@/server/arca/config/production-emission";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import {
  assertBillingMatchesIssue,
  canonicalizeBillingPayload,
  type ArcaBillingPersistenceSnapshot,
} from "@/server/arca/invoices/billing-payload-snapshot";
import {
  arcaEmissionLockScope,
  DuplicateArcaEmissionKeyError,
  DuplicateArcaVoucherNumberError,
  type ArcaEmissionLock,
  type ArcaEmissionRecord,
  type ArcaEmissionStore,
} from "@/server/arca/invoices/emission-store";
import {
  hashArcaFiscalRequest,
  type ArcaFiscalHashInput,
} from "@/server/arca/invoices/fiscal-request-hash";
import {
  ARCA_RETRY_FISCAL_DATE_CHANGED_MESSAGE,
  BillingInvoiceError,
} from "@/server/services/billing-invoice.errors";
import { voucherTypeForClass } from "@/shared/fiscal/arca-fiscal-mapping";
import { PRODUCTION_EMISSION_DISABLED_MESSAGE } from "@/shared/fiscal/production-emission";
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
 * Lock y red.
 *
 * pg_advisory_xact_lock se toma en una transacción que no escribe la emisión.
 * Esa transacción permanece abierta durante ticket, último autorizado y
 * FECAESolicitar (timeout 70s: tres llamadas de hasta 15s más margen).
 *
 * SENDING se confirma en otra conexión antes de requestCae. Si el proceso
 * cae después de que ARCA aceptó, la fila sigue en SENDING o AMBIGUOUS y
 * la reentrada reconcilia. No se reenvía FECAESolicitar.
 *
 * MODO_PRUEBA no entra a este flujo.
 * El snapshot comercial se guarda en PREPARED y no se vuelve a escribir.
 */

const MESSAGE_MAX_LENGTH = 240;

const LOCAL_REQUEST_CODES = new Set([
  "INVALID_CAE_REQUEST",
  "INVALID_TICKET",
  "TICKET_EXPIRED",
  "INVALID_ENVIRONMENT",
]);

export type IssueArcaInvoiceInput = ArcaFiscalHashInput & {
  idempotencyKey: string;
  /** Reloj de la operación. No entra al requestHash. */
  now?: Date;
};

export type IssueArcaInvoiceResult =
  | {
      status: "approved" | "completed";
      emissionId: string;
      voucherType: number;
      voucherNumber: number;
      authorizationCode: string;
      authorizationExpiresAt: string | null;
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

export type IssueArcaInvoiceDependencies = {
  store?: ArcaEmissionStore;
  lock?: ArcaEmissionLock;
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
  getAccessTicket: NonNullable<IssueArcaInvoiceDependencies["getAccessTicket"]>;
  getLastAuthorizedVoucher: NonNullable<
    IssueArcaInvoiceDependencies["getLastAuthorizedVoucher"]
  >;
  requestCae: NonNullable<IssueArcaInvoiceDependencies["requestCae"]>;
  reconcile: NonNullable<IssueArcaInvoiceDependencies["reconcile"]>;
};

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

  return {
    code: "UNEXPECTED",
    message: "No se pudo emitir el comprobante.",
  };
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

function toApproved(emission: ArcaEmissionRecord): IssueArcaInvoiceResult {
  return {
    status: emission.status === "COMPLETED" ? "completed" : "approved",
    emissionId: emission.id,
    voucherType: emission.voucherType,
    voucherNumber: emission.voucherNumber ?? 0,
    authorizationCode: emission.authorizationCode ?? "",
    authorizationExpiresAt: formatExpiration(emission.authorizationExpiresAt),
  };
}

function toRejected(emission: ArcaEmissionRecord): IssueArcaInvoiceResult {
  return {
    status: "rejected",
    emissionId: emission.id,
    voucherType: emission.voucherType,
    voucherNumber: emission.voucherNumber ?? 0,
  };
}

async function resolveDependencies(
  dependencies: IssueArcaInvoiceDependencies,
): Promise<ResolvedDependencies> {
  const store =
    dependencies.store ??
    (await import("@/server/arca/repositories/arca-emission.repository"))
      .arcaEmissionRepository;
  const lock =
    dependencies.lock ??
    (await import("@/server/arca/invoices/emission-lock")).withArcaEmissionLock;
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
    billingPayloadSnapshot: ArcaBillingPersistenceSnapshot;
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

export async function issueArcaInvoice(
  input: IssueArcaInvoiceInput,
  dependencies: IssueArcaInvoiceDependencies = {},
): Promise<IssueArcaInvoiceResult> {
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);
  const issuerCuit = normalizeIssuerCuit(input.issuerCuit);
  const pointOfSale = parseArcaPointOfSale(String(input.pointOfSale));
  let billingPayloadSnapshot: ArcaBillingPersistenceSnapshot;

  try {
    billingPayloadSnapshot = canonicalizeBillingPayload(input.billing);
  } catch (error) {
    throw new ArcaEmissionError(
      error instanceof Error
        ? error.message
        : "El snapshot comercial no es válido.",
      "ARCA_EMISSION_SNAPSHOT_MISMATCH",
    );
  }

  assertBillingMatchesIssue({
    pointOfSale,
    invoiceType: input.invoiceType,
    voucherDate: input.voucherDate,
    ivaPercent: input.ivaPercent,
    client: input.client,
    totals: input.totals,
    billing: billingPayloadSnapshot,
  });
  const requestHash = hashArcaFiscalRequest({
    ...input,
    issuerCuit,
    pointOfSale,
    billing: billingPayloadSnapshot,
  });
  const voucherType = voucherTypeForClass(input.invoiceType);
  const resolved = await resolveDependencies(dependencies);
  const emission = await loadOrCreate(resolved.store, {
    idempotencyKey,
    requestHash,
    environment: input.environment,
    issuerCuit,
    pointOfSale,
    invoiceType: input.invoiceType,
    voucherType,
    billingPayloadSnapshot,
  });

  return resolved.lock(
    arcaEmissionLockScope(input.environment, pointOfSale, voucherType),
    async () => {
      const current = await resolved.store.findById(emission.id);

      if (!current) {
        throw new Error("La emisión no existe.");
      }

      assertSameHash(current, requestHash);
      return resume(current, input, issuerCuit, pointOfSale, resolved);
    },
  );
}

async function resume(
  emission: ArcaEmissionRecord,
  input: IssueArcaInvoiceInput,
  issuerCuit: string,
  pointOfSale: number,
  dependencies: ResolvedDependencies,
): Promise<IssueArcaInvoiceResult> {
  switch (emission.status) {
    case "COMPLETED":
      return toApproved(emission);
    case "APPROVED_PENDING_PERSISTENCE":
      return toApproved(emission);
    case "REJECTED":
      return toRejected(emission);
    case "AMBIGUOUS":
      return reconcileExisting(emission, dependencies);
    case "SENDING":
      if (emission.voucherNumber === null) {
        return emitNew(emission, input, issuerCuit, pointOfSale, dependencies);
      }
      return reconcileExisting(emission, dependencies);
    case "PREPARED":
    case "FAILED_PRE_SEND":
      return emitNew(emission, input, issuerCuit, pointOfSale, dependencies);
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
): Promise<IssueArcaInvoiceResult> {
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

function assertUnsentProductionAllowed(environment: ArcaEnvironment): void {
  if (environment !== "PRODUCCION" || isArcaProductionEmissionEnabled()) {
    return;
  }

  throw new BillingInvoiceError(
    PRODUCTION_EMISSION_DISABLED_MESSAGE,
    "PRODUCTION_EMISSION_DISABLED",
  );
}

function assertUnsentRetryOnOriginalFiscalDay(
  status: ArcaEmissionRecord["status"],
  voucherDate: Date | string,
  now: Date | undefined,
): void {
  if (!now || (status !== "PREPARED" && status !== "FAILED_PRE_SEND")) {
    return;
  }

  if (formatArcaVoucherDate(voucherDate) === formatArcaVoucherDate(now)) {
    return;
  }

  throw new BillingInvoiceError(
    ARCA_RETRY_FISCAL_DATE_CHANGED_MESSAGE,
    "ARCA_RETRY_FISCAL_DATE_CHANGED",
  );
}

async function emitNew(
  emission: ArcaEmissionRecord,
  input: IssueArcaInvoiceInput,
  issuerCuit: string,
  pointOfSale: number,
  dependencies: ResolvedDependencies,
): Promise<IssueArcaInvoiceResult> {
  assertUnsentRetryOnOriginalFiscalDay(
    emission.status,
    input.voucherDate,
    input.now,
  );

  let ticket: ArcaAccessTicket;
  let fiscalRequest: ArcaCaeFiscalRequest;

  try {
    assertUnsentProductionAllowed(emission.environment);
    ticket = await dependencies.getAccessTicket(input.environment);
    const last = await dependencies.getLastAuthorizedVoucher({
      environment: input.environment,
      accessTicket: ticket,
      issuerCuit,
      pointOfSale,
      voucherType: emission.voucherType,
    });
    fiscalRequest = buildArcaCaeRequest({
      environment: input.environment,
      issuerCuit,
      pointOfSale,
      voucherNumber: last.lastNumber + 1,
      voucherDate: input.voucherDate,
      client: input.client,
      invoiceType: input.invoiceType,
      totals: input.totals,
      ivaPercent: input.ivaPercent,
    });
  } catch (error) {
    if (
      error instanceof BillingInvoiceError &&
      error.code === "PRODUCTION_EMISSION_DISABLED"
    ) {
      throw error;
    }

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
    return toRejected(rejected);
  }

  const approved = await dependencies.store.markApproved(emission.id, {
    authorizationCode: authorization.cae,
    authorizationExpiresAt: expirationDate(authorization.caeExpirationDate),
    arcaProcessDate: authorization.header.processDate,
    reprocess: authorization.header.reprocess,
    observations: coded(authorization.observations),
    events: coded(authorization.events),
  });
  return toApproved(approved);
}

async function reconcileExisting(
  emission: ArcaEmissionRecord,
  dependencies: ResolvedDependencies,
): Promise<IssueArcaInvoiceResult> {
  const snapshot = emission.fiscalRequestSnapshot;
  const voucherNumber = emission.voucherNumber;

  if (!snapshot || voucherNumber === null) {
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
      documentType: snapshot.documentType,
      documentNumber: snapshot.documentNumber,
      voucherDate: snapshot.voucherDate,
      totalAmount: snapshot.totalAmount,
      netAmount: snapshot.netAmount,
      vatAmount: snapshot.vatAmount,
      currencyId: snapshot.currencyId,
    },
  });

  if (reconciliation.status === "authorized") {
    const approved = await dependencies.store.markApproved(emission.id, {
      authorizationCode: reconciliation.authorizationCode,
      authorizationExpiresAt: expirationDate(reconciliation.expirationDate),
      arcaProcessDate: null,
      reprocess: null,
      observations: [],
      events: [],
    });
    return toApproved(approved);
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
