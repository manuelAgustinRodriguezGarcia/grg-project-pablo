/**
 * Etiqueta visible de un grupo: el comprobante más nuevo del conjunto.
 * La misma regla vale para un mes y para la unión de varios meses.
 */

export function isNewerDocumentLabel(
  currentIssuedAt: number,
  currentNumber: string,
  issuedAt: number,
  documentNumber: string,
): boolean {
  if (issuedAt !== currentIssuedAt) {
    return issuedAt > currentIssuedAt;
  }

  return documentNumber.localeCompare(currentNumber, "es-AR") > 0;
}

export function isNewerRubroSnapshot(
  current: {
    labelIssuedAt: number;
    labelSortOrder: number;
    labelNumber: string;
    rubroName: string;
  },
  next: {
    issuedAt: number;
    sortOrder: number;
    number: string;
    rubroName: string;
  },
): boolean {
  if (next.issuedAt !== current.labelIssuedAt) {
    return next.issuedAt > current.labelIssuedAt;
  }

  if (next.sortOrder !== current.labelSortOrder) {
    return next.sortOrder > current.labelSortOrder;
  }

  const byNumber = next.number.localeCompare(current.labelNumber, "es-AR");
  if (byNumber !== 0) {
    return byNumber > 0;
  }

  return next.rubroName.localeCompare(current.rubroName, "es-AR") > 0;
}
