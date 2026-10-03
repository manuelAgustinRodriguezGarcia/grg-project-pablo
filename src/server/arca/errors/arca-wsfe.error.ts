import "server-only";
import type { ArcaWsfeRemoteError } from "@/server/arca/wsfe/wsfe.types";

export type ArcaWsfeErrorCode =
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "SOAP_FAULT"
  | "ARCA_ERROR"
  | "INVALID_RESPONSE"
  | "INVALID_TICKET"
  | "TICKET_EXPIRED"
  | "INVALID_ENVIRONMENT"
  | "INVALID_CAE_REQUEST"
  | "INVALID_VOUCHER_QUERY"
  | "VOUCHER_NOT_FOUND";

export class ArcaWsfeError extends Error {
  readonly code: ArcaWsfeErrorCode;
  readonly faultCode?: string;
  readonly faultString?: string;
  readonly httpStatus?: number;
  readonly remoteErrors?: ArcaWsfeRemoteError[];

  constructor(
    message: string,
    code: ArcaWsfeErrorCode,
    details?: {
      faultCode?: string;
      faultString?: string;
      httpStatus?: number;
      remoteErrors?: ArcaWsfeRemoteError[];
    },
  ) {
    super(message);
    this.name = "ArcaWsfeError";
    this.code = code;
    this.faultCode = details?.faultCode;
    this.faultString = details?.faultString;
    this.httpStatus = details?.httpStatus;
    this.remoteErrors = details?.remoteErrors;
  }
}
