import { describe, expect, it } from "vitest";
import {
  discardNoteIdempotency,
  noteIntentionFingerprint,
  syncNoteIdempotency,
  type NoteIntention,
} from "@/features/billing/utils/note-idempotency";

const base: NoteIntention = {
  kind: "CREDIT",
  invoiceId: "invoice-1",
  amountCents: 1050,
  reason: "Devolución parcial",
};

function keys() {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `00000000-0000-4000-8000-00000000000${sequence}`;
  };
}

describe("note idempotency", () => {
  it("una intención nueva genera una clave", () => {
    const createKey = keys();
    const session = syncNoteIdempotency(
      null,
      noteIntentionFingerprint(base),
      createKey,
    );

    expect(session.key).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("un doble submit conserva la clave", () => {
    const createKey = keys();
    const fingerprint = noteIntentionFingerprint(base);
    const first = syncNoteIdempotency(null, fingerprint, createKey);
    const second = syncNoteIdempotency(first, fingerprint, createKey);

    expect(second.key).toBe(first.key);
    expect(second).toBe(first);
  });

  it("un retry ambiguo conserva la clave", () => {
    const createKey = keys();
    const fingerprint = noteIntentionFingerprint(base);
    const first = syncNoteIdempotency(null, fingerprint, createKey);
    const retry = syncNoteIdempotency(first, fingerprint, createKey);

    expect(retry.key).toBe(first.key);
  });

  it("modificar el importe rota la clave", () => {
    const createKey = keys();
    const first = syncNoteIdempotency(
      null,
      noteIntentionFingerprint(base),
      createKey,
    );
    const next = syncNoteIdempotency(
      first,
      noteIntentionFingerprint({ ...base, amountCents: 2000 }),
      createKey,
    );

    expect(next.key).not.toBe(first.key);
  });

  it("modificar el motivo rota la clave", () => {
    const createKey = keys();
    const first = syncNoteIdempotency(
      null,
      noteIntentionFingerprint(base),
      createKey,
    );
    const next = syncNoteIdempotency(
      first,
      noteIntentionFingerprint({ ...base, reason: "Otro motivo" }),
      createKey,
    );

    expect(next.key).not.toBe(first.key);
  });

  it("cambiar CREDIT y DEBIT rota la clave", () => {
    const createKey = keys();
    const first = syncNoteIdempotency(
      null,
      noteIntentionFingerprint(base),
      createKey,
    );
    const next = syncNoteIdempotency(
      first,
      noteIntentionFingerprint({ ...base, kind: "DEBIT" }),
      createKey,
    );

    expect(next.key).not.toBe(first.key);
  });

  it("cambiar la factura rota la clave", () => {
    const createKey = keys();
    const first = syncNoteIdempotency(
      null,
      noteIntentionFingerprint(base),
      createKey,
    );
    const next = syncNoteIdempotency(
      first,
      noteIntentionFingerprint({ ...base, invoiceId: "invoice-2" }),
      createKey,
    );

    expect(next.key).not.toBe(first.key);
  });

  it("el success descarta la clave", () => {
    expect(discardNoteIdempotency()).toBeNull();
  });
});
