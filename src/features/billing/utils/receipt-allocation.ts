import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";

export type ReceiptAllocationStatus = "A_CUENTA" | "PARCIAL" | "IMPUTADO";

export type InvoicePaymentStatusFromSaldo = "IMPAGA" | "PARCIALMENTE_PAGA" | "PAGA";

export type ReceiptAllocationRow = {
  invoiceId: string;
  issuedAt: Date;
  outstandingCents: number;
  selected: boolean;
  applyCents: number;
  applyLocked: boolean;
};

export function paymentStatusFromSaldoCents(
  outstandingCents: number,
  totalCents: number,
): InvoicePaymentStatusFromSaldo {
  if (outstandingCents <= 0) {
    return "PAGA";
  }

  if (outstandingCents >= totalCents) {
    return "IMPAGA";
  }

  return "PARCIALMENTE_PAGA";
}

export function receiptAllocationStatus(
  amountCents: number,
  allocatedCents: number,
): ReceiptAllocationStatus {
  const remaining = amountCents - allocatedCents;
  if (remaining >= amountCents) {
    return "A_CUENTA";
  }
  if (remaining <= 0) {
    return "IMPUTADO";
  }
  return "PARCIAL";
}

export function remainingCents(amountCents: number, allocatedCents: number): number {
  return Math.max(0, amountCents - allocatedCents);
}

/**
 * Reparte `amountCents` entre las filas seleccionadas, de la más antigua
 * a la más nueva. Las filas con `applyLocked` conservan su monto.
 */
export function allocateCreditFifo(
  rows: Array<{
    invoiceId: string;
    outstandingCents: number;
    issuedAt: Date;
  }>,
  creditCents: number,
): Map<string, number> {
  const ordered = [...rows].sort(
    (left, right) =>
      new Date(left.issuedAt).getTime() - new Date(right.issuedAt).getTime(),
  );

  let leftover = Math.max(0, creditCents);
  const applied = new Map<string, number>();

  for (const row of ordered) {
    const take = Math.max(0, Math.min(row.outstandingCents, leftover));
    applied.set(row.invoiceId, take);
    leftover -= take;
  }

  return applied;
}

export function cashNeededForInvoice(
  outstandingCents: number,
  creditAppliedCents: number,
): number {
  return Math.max(0, outstandingCents - Math.max(0, creditAppliedCents));
}

export function remainingAfterAllocation(
  outstandingCents: number,
  creditAppliedCents: number,
  cashCents: number,
): number {
  return Math.max(
    0,
    outstandingCents - Math.max(0, creditAppliedCents) - Math.max(0, cashCents),
  );
}

export function redistributeFifo(
  rows: ReceiptAllocationRow[],
  amountCents: number,
): ReceiptAllocationRow[] {
  const selected = rows
    .filter((row) => row.selected)
    .sort(
      (left, right) =>
        new Date(left.issuedAt).getTime() - new Date(right.issuedAt).getTime(),
    );

  let leftover = amountCents;
  const applyById = new Map<string, number>();

  for (const row of selected) {
    if (!row.applyLocked) {
      continue;
    }
    const capped = Math.max(0, Math.min(row.applyCents, row.outstandingCents));
    applyById.set(row.invoiceId, capped);
    leftover -= capped;
  }

  leftover = Math.max(0, leftover);

  for (const row of selected) {
    if (row.applyLocked) {
      continue;
    }
    const apply = Math.max(0, Math.min(row.outstandingCents, leftover));
    applyById.set(row.invoiceId, apply);
    leftover -= apply;
  }

  return rows.map((row) => ({
    ...row,
    applyCents: row.selected ? (applyById.get(row.invoiceId) ?? 0) : 0,
    applyLocked: row.selected ? row.applyLocked : false,
  }));
}

export function selectedAllocationCents(rows: ReceiptAllocationRow[]): number {
  return rows
    .filter((row) => row.selected)
    .reduce((sum, row) => sum + row.applyCents, 0);
}

export function parsePesosInput(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized || normalized === ".") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return pesosToCents(parsed);
}

export function formatPesosInput(cents: number): string {
  const [integer, fraction] = centsToPesos(cents).toFixed(2).split(".");
  return `${formatIntegerPesos(integer ?? "0")},${fraction ?? "00"}`;
}

/**
 * Máscara en vivo es-AR: solo dígitos, miles con `.`, decimal con `,` o `.`.
 * El punto de miles lo pone el formateo; un `.` o `,` tipeado abre decimales.
 */
export function maskPesosInput(raw: string): string {
  const filtered = raw.replace(/[^\d.,]/g, "");
  if (!filtered) {
    return "";
  }

  const commaIndex = filtered.indexOf(",");
  const endsWithDot = filtered.endsWith(".") && commaIndex === -1;

  let integerDigits: string;
  let decimalDigits: string | null = null;

  if (commaIndex !== -1) {
    integerDigits = filtered.slice(0, commaIndex).replace(/\D/g, "");
    decimalDigits = filtered
      .slice(commaIndex + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
  } else if (endsWithDot) {
    integerDigits = filtered.slice(0, -1).replace(/\D/g, "");
    decimalDigits = "";
  } else {
    integerDigits = filtered.replace(/\D/g, "");
  }

  const integerFormatted = formatIntegerPesos(integerDigits);

  if (decimalDigits === null) {
    return integerFormatted;
  }

  return `${integerFormatted || "0"},${decimalDigits}`;
}

function formatIntegerPesos(digits: string): string {
  if (!digits) {
    return "";
  }

  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export type CreditReceiptBucket = {
  receiptId: string;
  remainingCents: number;
};

export type CreditSplitResult = {
  creditAllocations: Array<{
    receiptId: string;
    invoiceId: string;
    amountCents: number;
  }>;
  newReceiptAllocations: Array<{
    invoiceId: string;
    amountCents: number;
  }>;
};

export function clientCreditCents(
  receipts: Array<{ id: string; clientId: string; remainingAmount: number }>,
  clientId: string,
  excludeReceiptId?: string | null,
): number {
  if (!clientId) {
    return 0;
  }

  return receipts.reduce((sum, receipt) => {
    if (receipt.clientId !== clientId) {
      return sum;
    }
    if (excludeReceiptId && receipt.id === excludeReceiptId) {
      return sum;
    }
    return sum + pesosToCents(receipt.remainingAmount);
  }, 0);
}

export function trappedInvoiceCreditCents(invoice: {
  paymentMethod: string;
  totalVisualRounded: number;
  creditNoteCap: number;
  receipts: Array<{ allocatedToInvoice: number }>;
}): number {
  if (invoice.paymentMethod !== "CUENTA_CORRIENTE") {
    return 0;
  }

  const payableCents = pesosToCents(invoice.creditNoteCap);
  const allocatedCents = invoice.receipts.reduce(
    (sum, receipt) => sum + pesosToCents(receipt.allocatedToInvoice),
    0,
  );
  return Math.max(0, allocatedCents - payableCents);
}

export function clientAvailableCreditCents(
  receipts: Array<{ id: string; clientId: string; remainingAmount: number }>,
  invoices: Array<{
    clientId: string | null;
    paymentMethod: string;
    totalVisualRounded: number;
    creditNoteCap: number;
    receipts: Array<{ allocatedToInvoice: number }>;
  }>,
  clientId: string,
  excludeReceiptId?: string | null,
): number {
  if (!clientId) {
    return 0;
  }

  const trappedCents = invoices.reduce((sum, invoice) => {
    if (invoice.clientId !== clientId) {
      return sum;
    }
    return sum + trappedInvoiceCreditCents(invoice);
  }, 0);

  return clientCreditCents(receipts, clientId, excludeReceiptId) + trappedCents;
}

export function splitApplyWithCredit(
  rows: Array<{ invoiceId: string; applyCents: number }>,
  creditReceipts: CreditReceiptBucket[],
  creditBudgetCents: number,
): CreditSplitResult {
  const remaining = creditReceipts.map((receipt) => ({ ...receipt }));
  const creditAllocations: CreditSplitResult["creditAllocations"] = [];
  const newReceiptAllocations: CreditSplitResult["newReceiptAllocations"] = [];
  let budget = Math.max(0, creditBudgetCents);

  for (const row of rows) {
    let need = row.applyCents;
    if (need <= 0) {
      continue;
    }

    if (budget > 0) {
      for (const bucket of remaining) {
        if (need <= 0 || budget <= 0) {
          break;
        }
        const take = Math.min(need, bucket.remainingCents, budget);
        if (take <= 0) {
          continue;
        }
        creditAllocations.push({
          receiptId: bucket.receiptId,
          invoiceId: row.invoiceId,
          amountCents: take,
        });
        bucket.remainingCents -= take;
        budget -= take;
        need -= take;
      }
    }

    if (need > 0) {
      newReceiptAllocations.push({
        invoiceId: row.invoiceId,
        amountCents: need,
      });
    }
  }

  return { creditAllocations, newReceiptAllocations };
}
