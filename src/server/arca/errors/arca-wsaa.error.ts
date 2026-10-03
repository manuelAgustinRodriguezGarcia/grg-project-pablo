import "server-only";

export type ArcaWsaaErrorCode =
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "SOAP_FAULT"
  | "INVALID_RESPONSE"
  | "TICKET_EXPIRED"
  | "CMS_ERROR"
  | "TRA_INVALID";

export class ArcaWsaaError extends Error {
  readonly code: ArcaWsaaErrorCode;
  readonly faultCode?: string;
  readonly faultString?: string;
  readonly httpStatus?: number;

  constructor(
    message: string,
    code: ArcaWsaaErrorCode,
    details?: {
      faultCode?: string;
      faultString?: string;
      httpStatus?: number;
    },
  ) {
    super(message);
    this.name = "ArcaWsaaError";
    this.code = code;
    this.faultCode = details?.faultCode;
    this.faultString = details?.faultString;
    this.httpStatus = details?.httpStatus;
  }
}
