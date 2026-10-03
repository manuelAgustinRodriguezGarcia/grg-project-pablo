import { describe, expect, it } from "vitest";
import {
  createSubmitLock,
  invoiceIntentionFingerprint,
  isRejectedIntentionBlocked,
  markInvoiceIdempotencyRejected,
  syncInvoiceIdempotency,
  type InvoiceIntentionFingerprintInput,
} from "@/features/billing/utils/invoice-idempotency";

const KEYS = ["key-1", "key-2", "key-3", "key-4"];

function intention(
  overrides: Partial<InvoiceIntentionFingerprintInput> = {},
): InvoiceIntentionFingerprintInput {
  return {
    clientId: "client-1",
    items: [
      {
        rubroId: "rubro-1",
        description: "Embrague",
        quantity: "1",
        unitPrice: "1210",
      },
    ],
    discountPercent: 0,
    paymentMethod: "CONTADO_EFECTIVO",
    notes: "",
    ...overrides,
  };
}

function keys() {
  const pending = [...KEYS];
  return () => {
    const next = pending.shift();
    if (!next) {
      throw new Error("No hay más claves de prueba.");
    }
    return next;
  };
}

describe("invoice idempotency", () => {
  it("un doble click deja un solo submit activo", () => {
    const lock = createSubmitLock();

    expect(lock.tryEnter()).toBe(true);
    expect(lock.tryEnter()).toBe(false);
    lock.leave();
    expect(lock.tryEnter()).toBe(true);
  });

  it("reutiliza la misma clave si la intención no cambia", () => {
    const createKey = keys();
    const fingerprint = invoiceIntentionFingerprint(intention());
    const first = syncInvoiceIdempotency(null, fingerprint, createKey);
    const retry = syncInvoiceIdempotency(first, fingerprint, createKey);

    expect(retry.key).toBe("key-1");
    expect(retry.key).toBe(first.key);
  });

  it("genera otra clave si cambia un ítem, el descuento o el cliente", () => {
    const createKey = keys();
    const original = invoiceIntentionFingerprint(intention());
    const session = syncInvoiceIdempotency(null, original, createKey);

    const changedItem = syncInvoiceIdempotency(
      session,
      invoiceIntentionFingerprint(
        intention({
          items: [
            {
              rubroId: "rubro-1",
              description: "Embrague",
              quantity: "2",
              unitPrice: "1210",
            },
          ],
        }),
      ),
      createKey,
    );
    const changedDiscount = syncInvoiceIdempotency(
      changedItem,
      invoiceIntentionFingerprint(intention({ discountPercent: 10 })),
      createKey,
    );
    const changedClient = syncInvoiceIdempotency(
      changedDiscount,
      invoiceIntentionFingerprint(intention({ clientId: "client-2" })),
      createKey,
    );

    expect(changedItem.key).toBe("key-2");
    expect(changedDiscount.key).toBe("key-3");
    expect(changedClient.key).toBe("key-4");
  });

  it("conserva la clave ante un error ambiguo o de persistencia local", () => {
    const createKey = keys();
    const fingerprint = invoiceIntentionFingerprint(intention());
    const session = syncInvoiceIdempotency(null, fingerprint, createKey);
    const afterAmbiguous = syncInvoiceIdempotency(
      session,
      fingerprint,
      createKey,
    );
    const afterPersistence = syncInvoiceIdempotency(
      afterAmbiguous,
      fingerprint,
      createKey,
    );

    expect(afterPersistence.key).toBe(session.key);
    expect(isRejectedIntentionBlocked(afterPersistence, fingerprint)).toBe(
      false,
    );
  });

  it("después de un rechazo exige un cambio y entonces genera otra clave", () => {
    const createKey = keys();
    const fingerprint = invoiceIntentionFingerprint(intention());
    const session = markInvoiceIdempotencyRejected(
      syncInvoiceIdempotency(null, fingerprint, createKey),
    );

    expect(isRejectedIntentionBlocked(session, fingerprint)).toBe(true);

    const unchanged = syncInvoiceIdempotency(session, fingerprint, createKey);
    expect(unchanged.key).toBe(session.key);
    expect(isRejectedIntentionBlocked(unchanged, fingerprint)).toBe(true);

    const corrected = syncInvoiceIdempotency(
      session,
      invoiceIntentionFingerprint(intention({ notes: "corregida" })),
      createKey,
    );
    expect(corrected.key).toBe("key-2");
    expect(corrected.rejectedFingerprint).toBeNull();
  });
});
