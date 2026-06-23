export { buildDetectedHeaders, detectSemanticFlags, headerToInternalKey, mapHeadersToFolderColumns } from "./column-mapper";
export { extractCellValue, toParsedFormula } from "./excel-cell.extractor";
export type { ExtractedCellValue } from "./excel-cell.extractor";
export { detectSheetImages } from "./excel-image.detector";
export type { SheetImageStats } from "./excel-image.detector";
export { parseWorksheet } from "./excel-sheet.parser";
export { parseSheetFromBuffer, parseWorkbookFromBuffer, toExcelJsBuffer } from "./excel-workbook.parser";
export { buildExistingCodeIndex, findMatchingProductId, normalizeCodeForMatch } from "./match-detector";
export { mapSheetToProducts } from "./product-row.mapper";
export type {
  ColumnMappingEntry,
  DetectedHeader,
  ImportJobConfig,
  MappedProductRow,
  ParsedFormula,
  ParsedSheet,
  ParsedSheetRow,
  ParsedWorkbook,
} from "./types";
