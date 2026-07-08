/**
 * Convierte títulos de columna importados desde Excel a texto legible en una sola línea.
 * Excel suele guardar saltos de línea (\r, \n) dentro de la celda de cabecera.
 */
export function formatColumnTitleForDisplay(value: string): string {
  return value
    .replace(/\r\n/g, " ")
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/[\t\f\v\u00a0\u1680\u2000-\u200b\u3000\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatProductFormColumnTitle(
  columnIndex: number,
  displayName: string,
): string {
  return `COL ${columnIndex}. - ${formatColumnTitleForDisplay(displayName)}`;
}
