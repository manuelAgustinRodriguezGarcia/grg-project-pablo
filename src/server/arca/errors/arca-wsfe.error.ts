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

export type ArcaWsfeNetworkFailure = {
  name: string;
  code?: string;
  causeCode?: string;
};

export class ArcaWsfeError extends Error {
  readonly code: ArcaWsfeErrorCode;
  readonly faultCode?: string;
  readonly faultString?: string;
  readonly httpStatus?: number;
  readonly remoteErrors?: ArcaWsfeRemoteError[];
  readonly networkFailure?: ArcaWsfeNetworkFailure;

  constructor(
    message: string,
    code: ArcaWsfeErrorCode,
    details?: {
      faultCode?: string;
      faultString?: string;
      httpStatus?: number;
      remoteErrors?: ArcaWsfeRemoteError[];
      networkFailure?: ArcaWsfeNetworkFailure;
    },
  ) {
    const failure = details?.networkFailure;
    const cause = failure ? sanitizedNetworkCause(failure) : undefined;
    super(message, cause ? { cause } : undefined);
    this.name = "ArcaWsfeError";
    this.code = code;
    this.faultCode = details?.faultCode;
    this.faultString = details?.faultString;
    this.httpStatus = details?.httpStatus;
    this.remoteErrors = details?.remoteErrors;
    this.networkFailure = failure;
  }
}

function sanitizedNetworkCause(failure: ArcaWsfeNetworkFailure): Error {
  const cause = new Error("WSFEv1 network failure");
  cause.name = failure.name;
  if (failure.code) {
    (cause as Error & { code?: string }).code = failure.code;
  }
  return cause;
}
