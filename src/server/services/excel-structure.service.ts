import type {
  ClassifySheetInput,
  ClassifySheetResult,
  SheetClassification,
} from "@/features/imports/types/sheet.types";

const INDEX_SHEET_PATTERNS = [
  /^indice$/i,
  /^índice$/i,
  /^index$/i,
  /^indice\s/i,
  /^índice\s/i,
  /^index\s/i,
];

const IGNORED_SHEET_PATTERNS = [
  /^sheet\d+$/i,
  /^hoja\d+$/i,
  /^temp/i,
  /^tmp/i,
];

function normalizeSheetName(sheetName: string): string {
  return sheetName.trim();
}

function matchesAnyPattern(name: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(name));
}

export class ExcelStructureService {
  classifySheet(input: ClassifySheetInput): ClassifySheetResult {
    const sheetName = normalizeSheetName(input.sheetName);

    if (!sheetName) {
      return {
        classification: "IGNORED",
        reason: "Nombre de hoja vacío.",
      };
    }

    if (matchesAnyPattern(sheetName, INDEX_SHEET_PATTERNS)) {
      return {
        classification: "INDEX",
        reason: "El nombre coincide con una hoja índice.",
      };
    }

    if (matchesAnyPattern(sheetName, IGNORED_SHEET_PATTERNS)) {
      return {
        classification: "IGNORED",
        reason: "El nombre coincide con una hoja temporal o genérica.",
      };
    }

    if (input.rowCount === 0) {
      return {
        classification: "IGNORED",
        reason: "La hoja no contiene filas.",
      };
    }

    if (input.hasTabularHeaders === false) {
      return {
        classification: "AUXILIARY",
        reason: "La hoja no tiene encabezados tabulares detectables.",
      };
    }

    return {
      classification: "IMPORTABLE",
      reason: "Hoja apta para importar como carpeta.",
    };
  }

  canCreateFolderFromSheet(classification: SheetClassification): boolean {
    return classification === "IMPORTABLE";
  }
}

export const excelStructureService = new ExcelStructureService();
