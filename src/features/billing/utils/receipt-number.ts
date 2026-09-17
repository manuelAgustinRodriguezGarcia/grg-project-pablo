export function buildReceiptNumber(sequenceNumber: number): string {
  return `REC-${String(sequenceNumber).padStart(6, "0")}`;
}

export function formatReceiptNumber(receiptNumber: string): string {
  const digits = receiptNumber.match(/(\d+)\s*$/)?.[1];
  if (!digits) {
    return receiptNumber;
  }

  return `REC-${digits.slice(-6).padStart(6, "0")}`;
}
