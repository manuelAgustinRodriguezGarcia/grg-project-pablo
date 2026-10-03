export type InvoiceIntentionItem = {
  rubroId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

export type InvoiceIntentionFingerprintInput = {
  clientId: string;
  items: InvoiceIntentionItem[];
  discountPercent: number;
  paymentMethod: string;
  notes: string;
};

export type InvoiceIdempotencySession = {
  fingerprint: string;
  key: string;
  rejectedFingerprint: string | null;
};

export function invoiceIntentionFingerprint(
  input: InvoiceIntentionFingerprintInput,
): string {
  return JSON.stringify({
    clientId: input.clientId,
    items: input.items.map((item) => ({
      rubroId: item.rubroId,
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    discountPercent: input.discountPercent,
    paymentMethod: input.paymentMethod,
    notes: input.notes.trim(),
  });
}

export function syncInvoiceIdempotency(
  session: InvoiceIdempotencySession | null,
  fingerprint: string,
  createKey: () => string,
): InvoiceIdempotencySession {
  if (session && session.fingerprint === fingerprint) {
    return session;
  }

  return {
    fingerprint,
    key: createKey(),
    rejectedFingerprint: null,
  };
}

export function markInvoiceIdempotencyRejected(
  session: InvoiceIdempotencySession,
): InvoiceIdempotencySession {
  return {
    ...session,
    rejectedFingerprint: session.fingerprint,
  };
}

export function isRejectedIntentionBlocked(
  session: InvoiceIdempotencySession | null,
  fingerprint: string,
): boolean {
  return session?.rejectedFingerprint === fingerprint;
}

export function createSubmitLock(): {
  tryEnter: () => boolean;
  leave: () => void;
} {
  let active = false;

  return {
    tryEnter() {
      if (active) {
        return false;
      }

      active = true;
      return true;
    },
    leave() {
      active = false;
    },
  };
}
