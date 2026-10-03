import "server-only";

export {
  ArcaConfigurationError,
  type ArcaConfigurationErrorCode,
} from "@/server/arca/errors/arca-configuration.error";
export { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
export {
  getArcaCertificate,
  getArcaCredentials,
  getArcaPrivateKey,
} from "@/server/arca/config/credentials";
export type {
  ArcaCredentials,
  ArcaEndpoints,
  ArcaEnvironment,
  ArcaIssuerContext,
} from "@/server/arca/types/arca.types";
export {
  ArcaWsaaError,
  type ArcaWsaaErrorCode,
} from "@/server/arca/errors/arca-wsaa.error";
export { buildLoginTicketRequest } from "@/server/arca/wsaa/build-tra";
export { signLoginTicketRequest } from "@/server/arca/wsaa/sign-tra";
export { requestWsaaTicket } from "@/server/arca/wsaa/wsaa-client";
export type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
export { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
export {
  ArcaTicketCacheError,
  type ArcaTicketCacheErrorCode,
} from "@/server/arca/errors/arca-ticket-cache.error";
export { ARCA_TICKET_REUSE_MARGIN_MS } from "@/server/arca/tickets/ticket-validity";
export {
  ArcaWsfeError,
  type ArcaWsfeErrorCode,
} from "@/server/arca/errors/arca-wsfe.error";
export { reconcileVoucherAfterAmbiguousEmission } from "@/server/arca/wsfe/reconcile-voucher";
export type {
  AmbiguousVoucherExpectation,
  VoucherMismatchField,
  VoucherReconciliation,
} from "@/server/arca/wsfe/reconcile-voucher";
export {
  consultVoucher,
  getLastAuthorizedVoucher,
  getMaxRecordsPerRequest,
  requestCae,
} from "@/server/arca/wsfe/wsfe-client";
export { buildArcaCaeRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
export type {
  ArcaBillingInvoiceInput,
  ArcaCaeFiscalRequest,
} from "@/server/arca/adapters/billing-invoice-to-cae";
export {
  ArcaInvoiceAdapterError,
  type ArcaInvoiceAdapterErrorCode,
} from "@/server/arca/errors/arca-invoice-adapter.error";
export type {
  ArcaCaeAuthorization,
  ArcaCaeDetail,
  ArcaCaeHeader,
  ArcaCaeRequest,
  ArcaVatRate,
  ArcaVoucher,
  ArcaVoucherQuery,
  ArcaWsfeEvent,
  ArcaWsfeObservation,
  ArcaWsfeRemoteError,
  LastAuthorizedVoucher,
  MaxRecordsPerRequest,
} from "@/server/arca/wsfe/wsfe.types";
export { issueArcaInvoice } from "@/server/arca/invoices/issue-arca-invoice";
export type {
  IssueArcaInvoiceInput,
  IssueArcaInvoiceResult,
} from "@/server/arca/invoices/issue-arca-invoice";
export {
  ArcaEmissionError,
  type ArcaEmissionErrorCode,
} from "@/server/arca/errors/arca-emission.error";
export { hashArcaFiscalRequest } from "@/server/arca/invoices/fiscal-request-hash";
export { finalizeApprovedArcaEmission } from "@/server/arca/invoices/finalize-approved-arca-emission";
export type {
  FinalizeApprovedResult,
  FinalizedArcaInvoice,
} from "@/server/arca/invoices/finalize-approved-arca-emission";
export type { ArcaBillingPersistenceSnapshot } from "@/server/arca/invoices/billing-payload-snapshot";
export { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
export { toArcaIssuerContext } from "@/server/arca/utils/issuer-context";
export { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
