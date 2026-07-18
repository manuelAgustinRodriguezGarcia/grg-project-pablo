/** Broad labels for picture columns (NOT ZIP image-code columns). */
const IMAGE_LABEL_HEADER_PATTERNS = [/imagen/i, /image/i, /foto/i, /photo/i];
/** ZIP filename match columns: "COD. IMG.", "CODIGO IMAGEN", etc. */
const IMAGE_CODE_COLUMN_PATTERNS = [
  /\bcod(?:igo)?\.?\s*imagen\b/i,
  /\bcod(?:igo)?\.?\s*img\.?\b/i,
  /\bcodigoimagen\b/i,
  /\bcodimg\b/i,
];
const CODE_HEADER_PATTERNS = [/c[oó]digo/i, /^cod\./i, /referencia/i, /^ref\.?$/i];
const DESCRIPTION_HEADER_PATTERNS = [/descripci[oó]n/i, /^desc\.?$/i, /detalle/i];
const PRICE_HEADER_PATTERNS = [/precio/i, /importe/i, /monto/i, /costo/i, /valor/i];

export function normalizeHeaderNameForSemantics(headerName: string): string {
  return headerName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .trim();
}

function matchesHeaderPattern(headerName: string, patterns: RegExp[]): boolean {
  const normalized = normalizeHeaderNameForSemantics(headerName);
  return patterns.some((pattern) => pattern.test(normalized));
}

export function isImageCodeColumnName(headerName: string): boolean {
  const normalized = normalizeHeaderNameForSemantics(headerName);
  return IMAGE_CODE_COLUMN_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Plain image/foto headers (e.g. "IMAGEN") used next to embedded pictures.
 * These must NOT activate ZIP-linked image-code mode.
 */
export function isBroadImageLabelHeader(headerName: string): boolean {
  return (
    matchesHeaderPattern(headerName, IMAGE_LABEL_HEADER_PATTERNS) &&
    !isImageCodeColumnName(headerName)
  );
}

export function detectSemanticFlags(headerName: string): {
  isPrimaryCode: boolean;
  isDescription: boolean;
  isImageCode: boolean;
  isPrice: boolean;
} {
  const isImageCode = isImageCodeColumnName(headerName);

  return {
    isPrimaryCode:
      !isImageCode && matchesHeaderPattern(headerName, CODE_HEADER_PATTERNS),
    isDescription: matchesHeaderPattern(headerName, DESCRIPTION_HEADER_PATTERNS),
    isImageCode,
    isPrice: matchesHeaderPattern(headerName, PRICE_HEADER_PATTERNS),
  };
}

export type ColumnSemanticKind = "primaryCode" | "description" | "imageCode" | null;

export function detectColumnSemanticKind(headerName: string): ColumnSemanticKind {
  if (isImageCodeColumnName(headerName)) {
    return "imageCode";
  }

  if (matchesHeaderPattern(headerName, CODE_HEADER_PATTERNS)) {
    return "primaryCode";
  }

  if (matchesHeaderPattern(headerName, DESCRIPTION_HEADER_PATTERNS)) {
    return "description";
  }

  return null;
}

export function semanticKindLabel(kind: ColumnSemanticKind): string | null {
  switch (kind) {
    case "primaryCode":
      return "Código";
    case "description":
      return "Descripción";
    case "imageCode":
      return "Código imagen";
    default:
      return null;
  }
}

export function isImageCodeHeader(headerName: string): boolean {
  return isImageCodeColumnName(headerName);
}
