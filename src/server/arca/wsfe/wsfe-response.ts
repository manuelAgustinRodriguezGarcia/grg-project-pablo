import "server-only";
import { XMLParser } from "fast-xml-parser";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import type {
  ArcaWsfeEvent,
  ArcaWsfeRemoteError,
} from "@/server/arca/wsfe/wsfe.types";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

export type ParsedWsfeResult = {
  result: Record<string, unknown>;
  events: ArcaWsfeEvent[];
  errors: ArcaWsfeRemoteError[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function findRecord(node: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(node)) {
    return null;
  }

  const direct = node[key];
  if (isRecord(direct)) {
    return direct;
  }

  for (const value of Object.values(node)) {
    const found = findRecord(value, key);
    if (found) {
      return found;
    }
  }

  return null;
}

function asList(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function redactSecrets(value: string, secrets: readonly string[]): string {
  let redacted = value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]");

  for (const secret of secrets) {
    if (secret.length >= 4) {
      redacted = redacted.replaceAll(secret, "[redacted]");
    }
  }

  return redacted.slice(0, 300);
}

function invalidResponse(): ArcaWsfeError {
  return new ArcaWsfeError(
    "La respuesta de WSFEv1 no se pudo interpretar.",
    "INVALID_RESPONSE",
  );
}

function tryParseXml(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = parser.parse(body);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function throwIfSoapFault(
  document: Record<string, unknown>,
  secrets: readonly string[],
): void {
  const fault = findRecord(document, "Fault");

  if (!fault) {
    return;
  }

  const faultCode = textOf(fault.faultcode);
  const faultString = textOf(fault.faultstring);

  throw new ArcaWsfeError("WSFE rechazó la consulta.", "SOAP_FAULT", {
    faultCode: faultCode ? redactSecrets(faultCode, secrets) : undefined,
    faultString: faultString ? redactSecrets(faultString, secrets) : undefined,
  });
}

export function readWsfeCodedItems(
  container: unknown,
  itemKey: "Err" | "Evt" | "Obs",
  secrets: readonly string[],
): Array<{ code: string; message: string }> {
  if (container === undefined || container === null || container === "") {
    return [];
  }

  if (!isRecord(container) || !(itemKey in container)) {
    throw invalidResponse();
  }

  return asList(container[itemKey]).map((item) => {
    if (!isRecord(item)) {
      throw invalidResponse();
    }

    const code = textOf(item.Code);
    const message = textOf(item.Msg);

    if (!code || !message) {
      throw invalidResponse();
    }

    return {
      code: redactSecrets(code, secrets),
      message: redactSecrets(message, secrets),
    };
  });
}

function readRemoteErrors(
  result: Record<string, unknown>,
  secrets: readonly string[],
): ArcaWsfeRemoteError[] {
  return readWsfeCodedItems(result.Errors, "Err", secrets);
}

function readEvents(
  result: Record<string, unknown>,
  secrets: readonly string[],
): ArcaWsfeEvent[] {
  return readWsfeCodedItems(result.Events, "Evt", secrets);
}

export function requireWsfeInteger(
  value: unknown,
  minimum: number,
): number {
  const text = textOf(value);

  if (!text || !/^\d+$/.test(text)) {
    throw invalidResponse();
  }

  const parsed = Number(text);

  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw invalidResponse();
  }

  return parsed;
}

export function interpretWsfeResponse(input: {
  httpStatus: number;
  body: string;
  resultTag: string;
  secrets: readonly string[];
  errors?: "throw" | "return";
}): ParsedWsfeResult {
  const httpFailed = input.httpStatus < 200 || input.httpStatus >= 300;
  const document = tryParseXml(input.body);

  if (!document) {
    if (httpFailed) {
      throw new ArcaWsfeError("WSFE respondió con un error HTTP.", "HTTP_ERROR", {
        httpStatus: input.httpStatus,
      });
    }

    throw invalidResponse();
  }

  throwIfSoapFault(document, input.secrets);

  if (httpFailed) {
    throw new ArcaWsfeError("WSFE respondió con un error HTTP.", "HTTP_ERROR", {
      httpStatus: input.httpStatus,
    });
  }

  const result = findRecord(document, input.resultTag);

  if (!result) {
    throw invalidResponse();
  }

  const remoteErrors = readRemoteErrors(result, input.secrets);
  const errorMode = input.errors ?? "throw";

  if (remoteErrors.length > 0 && errorMode === "throw") {
    throw new ArcaWsfeError("WSFE rechazó la consulta.", "ARCA_ERROR", {
      remoteErrors,
    });
  }

  if (errorMode !== "throw" && errorMode !== "return") {
    const unexpected: never = errorMode;
    throw unexpected;
  }

  return {
    result,
    events: readEvents(result, input.secrets),
    errors: remoteErrors,
  };
}
