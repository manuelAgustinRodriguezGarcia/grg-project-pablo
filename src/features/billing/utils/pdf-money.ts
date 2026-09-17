const PDF_AMOUNT_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PDF_QUANTITY_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Importes del PDF con miles por punto, como pide el PRD §20.3. */
export function formatPdfAmount(amount: number): string {
  return PDF_AMOUNT_FORMATTER.format(amount);
}

export function formatPdfQuantity(quantity: number): string {
  return PDF_QUANTITY_FORMATTER.format(quantity);
}
