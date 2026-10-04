import type { BillingNoteKind } from "@/generated/prisma/client";

export type NoteIntention = {
  kind: BillingNoteKind;
  invoiceId: string;
  amountCents: number;
  reason: string;
};

export type NoteIdempotencySession = {
  fingerprint: string;
  key: string;
};

export function noteIntentionFingerprint(input: NoteIntention): string {
  return JSON.stringify({
    kind: input.kind,
    invoiceId: input.invoiceId,
    amountCents: input.amountCents,
    reason: input.reason.trim(),
  });
}

export function syncNoteIdempotency(
  session: NoteIdempotencySession | null,
  fingerprint: string,
  createKey: () => string,
): NoteIdempotencySession {
  if (session && session.fingerprint === fingerprint) {
    return session;
  }

  return {
    fingerprint,
    key: createKey(),
  };
}

export function discardNoteIdempotency(): null {
  return null;
}
