import "server-only";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";

export type ArcaWsfeEvent = {
  code: string;
  message: string;
};

export type ArcaWsfeRemoteError = {
  code: string;
  message: string;
};

export type ArcaWsfeObservation = {
  code: string;
  message: string;
};

export type ArcaVatRate = {
  id: number;
  baseAmount: number;
  amount: number;
};

/** Comprobante asociado de WSFEv1. issuedAt es YYYYMMDD cuando está presente. */
export type ArcaAssociatedVoucher = {
  type: number;
  pointOfSale: number;
  number: number;
  issuerCuit?: string;
  issuedAt?: string;
};

export type ArcaCaeRequest = {
  environment: ArcaEnvironment | "MODO_PRUEBA";
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
  pointOfSale: number;
  voucherType: number;
  concept: number;
  documentType: number;
  documentNumber: number;
  voucherFrom: number;
  voucherTo: number;
  voucherDate: string;
  totalAmount: number;
  nonTaxedAmount: number;
  netAmount: number;
  exemptAmount: number;
  taxAmount: number;
  vatAmount: number;
  currencyId: string;
  currencyRate: number;
  receiverVatConditionId: number;
  vatBreakdown: ArcaVatRate[];
  associatedVouchers?: ArcaAssociatedVoucher[];
};

export type ArcaCaeHeader = {
  cuit: string;
  pointOfSale: number;
  voucherType: number;
  processDate: string;
  recordCount: number;
  result: "A" | "R";
  reprocess: "S" | "N";
};

export type ArcaCaeDetail = {
  concept: number;
  documentType: number;
  documentNumber: number;
  voucherFrom: number;
  voucherTo: number;
  voucherDate: string;
  result: "A" | "R";
  observations: ArcaWsfeObservation[];
};

type ArcaCaeResponseBase = {
  header: ArcaCaeHeader;
  detail: ArcaCaeDetail;
  observations: ArcaWsfeObservation[];
  errors: ArcaWsfeRemoteError[];
  events: ArcaWsfeEvent[];
};

export type ArcaCaeAuthorization =
  | (ArcaCaeResponseBase & {
      status: "approved";
      result: "A";
      cae: string;
      caeExpirationDate: string;
    })
  | (ArcaCaeResponseBase & {
      status: "rejected";
      result: "R";
      cae: null;
      caeExpirationDate: null;
    });

export type MaxRecordsPerRequest = {
  maxRecords: number;
  events: ArcaWsfeEvent[];
};

export type LastAuthorizedVoucher = {
  pointOfSale: number;
  voucherType: number;
  lastNumber: number;
  events: ArcaWsfeEvent[];
};

export type ArcaVoucherQuery = {
  environment: ArcaEnvironment | "MODO_PRUEBA";
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
  pointOfSale: number;
  voucherType: number;
  voucherNumber: number;
};

export type ArcaVoucher = {
  result: "A" | "R";
  authorizationCode: string;
  emissionType: string;
  authorizationExpirationDate: string;
  processDate: string;
  pointOfSale: number;
  voucherType: number;
  voucherNumber: number;
  voucherDate: string;
  concept: number;
  documentType: number;
  documentNumber: number;
  totalAmount: number;
  nonTaxedAmount: number;
  netAmount: number;
  exemptAmount: number;
  taxAmount: number;
  vatAmount: number;
  currencyId: string;
  currencyRate: number;
  receiverVatConditionId: number;
  vatBreakdown: ArcaVatRate[];
  observations: ArcaWsfeObservation[];
  events: ArcaWsfeEvent[];
};
