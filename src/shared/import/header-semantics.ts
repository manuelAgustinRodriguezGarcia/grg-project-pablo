const IMAGE_HEADER_PATTERNS = [/imagen/i, /image/i, /foto/i, /photo/i];
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

export function detectSemanticFlags(headerName: string): {
  isPrimaryCode: boolean;
  isDescription: boolean;
  isImageCode: boolean;
  isPrice: boolean;
} {
  return {
    isPrimaryCode: matchesHeaderPattern(headerName, CODE_HEADER_PATTERNS),
    isDescription: matchesHeaderPattern(headerName, DESCRIPTION_HEADER_PATTERNS),
    isImageCode: matchesHeaderPattern(headerName, IMAGE_HEADER_PATTERNS),
    isPrice: matchesHeaderPattern(headerName, PRICE_HEADER_PATTERNS),
  };
}

export type ColumnSemanticKind = "primaryCode" | "description" | "imageCode" | null;

export function detectColumnSemanticKind(headerName: string): ColumnSemanticKind {
  if (matchesHeaderPattern(headerName, IMAGE_HEADER_PATTERNS)) {
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
  return detectSemanticFlags(headerName).isImageCode;
}
