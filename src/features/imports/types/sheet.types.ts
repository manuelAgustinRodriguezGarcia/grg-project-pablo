export const SHEET_CLASSIFICATIONS = [
  "IMPORTABLE",
  "INDEX",
  "AUXILIARY",
  "IGNORED",
] as const;

export type SheetClassification = (typeof SHEET_CLASSIFICATIONS)[number];

export type ClassifySheetInput = {
  sheetName: string;
  rowCount?: number;
  hasTabularHeaders?: boolean;
};

export type ClassifySheetResult = {
  classification: SheetClassification;
  reason: string;
};
