import "server-only";
import type {
  BillingArcaEmissionStatus,
  BillingInvoiceType,
} from "@/generated/prisma/client";
import type { ArcaCaeFiscalRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import type { ArcaBillingPersistenceSnapshot } from "@/server/arca/invoices/billing-payload-snapshot";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";

export type ArcaCodedItem = {
  code: string;
  message: string;
};

export type ArcaEmissionRecord = {
  id: string;
  idempotencyKey: string;
  requestHash: string;
  environment: ArcaEnvironment;
  service: string;
  status: BillingArcaEmissionStatus;
  issuerCuit: string;
  pointOfSale: number;
  invoiceType: BillingInvoiceType;
  voucherType: number;
  voucherNumber: number | null;
  fiscalRequestSnapshot: ArcaCaeFiscalRequest | null;
  arcaResult: "A" | "R" | null;
  authorizationCode: string | null;
  authorizationExpiresAt: Date | null;
  arcaProcessDate: string | null;
  reprocess: "S" | "N" | null;
  observations: ArcaCodedItem[];
  errors: ArcaCodedItem[];
  events: ArcaCodedItem[];
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  billingPayloadSnapshot: ArcaBillingPersistenceSnapshot | null;
  invoiceId: string | null;
};

export type CreatePreparedEmission = {
  idempotencyKey: string;
  requestHash: string;
  environment: ArcaEnvironment;
  issuerCuit: string;
  pointOfSale: number;
  invoiceType: BillingInvoiceType;
  voucherType: number;
  billingPayloadSnapshot: ArcaBillingPersistenceSnapshot;
};

export type SendingEmissionUpdate = {
  voucherNumber: number;
  voucherType: number;
  fiscalRequestSnapshot: ArcaCaeFiscalRequest;
};

export type ApprovedEmissionUpdate = {
  authorizationCode: string;
  authorizationExpiresAt: Date | null;
  arcaProcessDate: string | null;
  reprocess: "S" | "N" | null;
  observations: ArcaCodedItem[];
  events: ArcaCodedItem[];
};

export type RejectedEmissionUpdate = {
  observations: ArcaCodedItem[];
  errors: ArcaCodedItem[];
  events: ArcaCodedItem[];
};

export type EmissionFailureUpdate = {
  code: string;
  message: string;
  clearVoucherNumber?: boolean;
};

export class DuplicateArcaEmissionKeyError extends Error {
  readonly code = "DUPLICATE_IDEMPOTENCY_KEY";

  constructor() {
    super("Ya existe una emisión con esta clave.");
    this.name = "DuplicateArcaEmissionKeyError";
  }
}

export class DuplicateArcaVoucherNumberError extends Error {
  readonly code = "DUPLICATE_VOUCHER_NUMBER";

  constructor() {
    super("El número de comprobante ya está reservado.");
    this.name = "DuplicateArcaVoucherNumberError";
  }
}

export type ArcaEmissionStore = {
  findByIdempotencyKey(key: string): Promise<ArcaEmissionRecord | null>;
  findById(id: string): Promise<ArcaEmissionRecord | null>;
  createPrepared(data: CreatePreparedEmission): Promise<ArcaEmissionRecord>;
  updateSending(
    id: string,
    data: SendingEmissionUpdate,
  ): Promise<ArcaEmissionRecord>;
  markApproved(
    id: string,
    data: ApprovedEmissionUpdate,
  ): Promise<ArcaEmissionRecord>;
  markRejected(
    id: string,
    data: RejectedEmissionUpdate,
  ): Promise<ArcaEmissionRecord>;
  markAmbiguous(
    id: string,
    data: EmissionFailureUpdate,
  ): Promise<ArcaEmissionRecord>;
  markFailedPreSend(
    id: string,
    data: EmissionFailureUpdate,
  ): Promise<ArcaEmissionRecord>;
};

export type ArcaEmissionLock = <T>(
  scope: string,
  task: () => Promise<T>,
) => Promise<T>;

export function arcaEmissionLockScope(
  environment: string,
  pointOfSale: number,
  voucherType: number,
): string {
  return `${environment}|${pointOfSale}|${voucherType}`;
}
