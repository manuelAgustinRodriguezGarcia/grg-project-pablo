import { BUCKET_CONFIGS } from "./config";
import { getFileExtension } from "./sanitize-filename";
import { STORAGE_BUCKETS } from "./types";

const EXCEL_CONFIG = BUCKET_CONFIGS[STORAGE_BUCKETS.EXCEL_ORIGINALS];

const MIME_BY_EXTENSION: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroenabled.12",
};

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Los navegadores en Windows suelen reportar .xlsx como application/vnd.ms-excel
 * u application/octet-stream. Preferimos el MIME canónico según la extensión.
 */
export function resolveExcelContentType(
  filename: string,
  reportedType: string,
): string {
  const extensionMime = MIME_BY_EXTENSION[getFileExtension(filename)];
  const allowedMimeTypes = EXCEL_CONFIG.allowedMimeTypes.map(normalizeContentType);
  const normalizedReported = normalizeContentType(reportedType);

  if (
    extensionMime &&
    allowedMimeTypes.includes(normalizeContentType(extensionMime))
  ) {
    return extensionMime;
  }

  if (normalizedReported && allowedMimeTypes.includes(normalizedReported)) {
    return normalizedReported;
  }

  return MIME_BY_EXTENSION[".xlsx"];
}
