export type BillingNoteKindCode = "CREDIT" | "DEBIT";

const SEQUENCE_DIGITS = 9;

export function noteKindPrefix(kind: BillingNoteKindCode): "NC" | "ND" {
  switch (kind) {
    case "CREDIT":
      return "NC";
    case "DEBIT":
      return "ND";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function buildNoteNumber(
  pointOfSale: string,
  kind: BillingNoteKindCode,
  sequenceNumber: number,
): string {
  const sequence = String(sequenceNumber).padStart(SEQUENCE_DIGITS, "0");
  return `${pointOfSale}-PRUEBA-${noteKindPrefix(kind)}-${sequence}`;
}

export function formatNoteNumber(noteNumber: string): string {
  return noteNumber;
}
