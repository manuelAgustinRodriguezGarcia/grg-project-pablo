import "server-only";
import { createHash } from "node:crypto";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import type { ArcaNotePersistenceSnapshot } from "@/server/arca/notes/note-payload-snapshot";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * createdByUserId no entra en el hash.
 * La idempotencyKey es el intento lógico original: un reintento recupera
 * el documento del primer intento aunque la sesión tenga otro usuario.
 */
export function hashArcaNoteRequest(input: {
  issuerCuit: string;
  snapshot: ArcaNotePersistenceSnapshot;
}): string {
  const snapshot = input.snapshot;
  const payload = {
    documentKind: "NOTE" as const,
    kind: snapshot.kind,
    invoiceId: snapshot.invoiceId,
    environment: snapshot.associatedInvoice.environment,
    invoiceType: snapshot.associatedInvoice.invoiceType,
    pointOfSale: parseArcaPointOfSale(snapshot.associatedInvoice.pointOfSale),
    associatedInvoice: {
      sequenceNumber: snapshot.associatedInvoice.sequenceNumber,
      issuedOn: formatArcaVoucherDate(snapshot.associatedInvoice.issuedAt),
      cae: snapshot.associatedInvoice.cae,
    },
    issuerCuit: normalizeIssuerCuit(input.issuerCuit),
    amountCents: snapshot.amountCents,
    netAmountCents: snapshot.netAmountCents,
    ivaAmountCents: snapshot.ivaAmountCents,
    ivaPercent: snapshot.ivaPercent,
    reason: snapshot.reason,
    receptor: {
      identificationType: snapshot.client.identificationType,
      identificationNumber: snapshot.client.identificationNumber,
      ivaCondition: snapshot.client.ivaCondition,
    },
    issuedOn: formatArcaVoucherDate(snapshot.issuedAt),
  };

  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
