import type { ColumnDataType, FolderColumn } from "@/generated/prisma/client";
import { detectSemanticFlags } from "@/shared/import/header-semantics";
import type { DetectedHeader } from "./types";

function slugifyHeader(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return normalized || "columna";
}

function ensureUniqueKey(base: string, used: Set<string>): string {
  let key = base;
  let counter = 2;

  while (used.has(key)) {
    key = `${base}_${counter}`;
    counter += 1;
  }

  used.add(key);
  return key;
}

function inferDataTypeFromHeader(headerName: string): ColumnDataType {
  if (detectSemanticFlags(headerName).isImageCode) {
    return "IMAGE";
  }

  return "TEXT";
}

export function headerToInternalKey(headerName: string, usedKeys: Set<string>): string {
  return ensureUniqueKey(slugifyHeader(headerName), usedKeys);
}

export { detectSemanticFlags, isImageCodeHeader } from "@/shared/import/header-semantics";

export function buildDetectedHeaders(
  entries: Array<{ originalName: string; columnIndex: number }>,
): DetectedHeader[] {
  const usedKeys = new Set<string>();

  return entries.map(({ originalName, columnIndex }) => ({
    originalName,
    internalKey: headerToInternalKey(originalName, usedKeys),
    columnIndex,
    inferredDataType: inferDataTypeFromHeader(originalName),
  }));
}

export function mapHeadersToFolderColumns(
  headers: DetectedHeader[],
  existingColumns: FolderColumn[],
): Map<string, FolderColumn> {
  const byOriginalName = new Map(
    existingColumns.map((column) => [column.originalName.toLowerCase(), column]),
  );
  const byInternalKey = new Map(
    existingColumns.map((column) => [column.internalKey, column]),
  );

  const mapping = new Map<string, FolderColumn>();

  for (const header of headers) {
    const byName = byOriginalName.get(header.originalName.toLowerCase());
    const byKey = byInternalKey.get(header.internalKey);
    const column = byName ?? byKey;

    if (column) {
      mapping.set(header.internalKey, column);
    }
  }

  return mapping;
}
