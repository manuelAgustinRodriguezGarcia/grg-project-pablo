import type { PriceColumn } from "@/generated/prisma/client";
import type { MappedPriceItemRow } from "@/server/importers/price-item-row.mapper";

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  return String(value).trim().length === 0;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

export function buildIndexedTextForMappedPriceItem(
  columns: PriceColumn[],
  item: Pick<MappedPriceItemRow, "primaryCode" | "description" | "dynamicData" | "amount">,
): string | null {
  const parts: string[] = [];

  if (item.primaryCode) {
    parts.push(item.primaryCode);
  }

  if (item.description) {
    parts.push(item.description);
  }

  if (item.amount) {
    parts.push(item.amount);
  }

  for (const column of columns) {
    if (!column.isSearchable) {
      continue;
    }

    const value = item.dynamicData[column.internalKey];
    if (!isEmptyValue(value)) {
      parts.push(stringifyValue(value));
    }
  }

  const unique = [...new Set(parts.map((part) => part.trim()).filter(Boolean))];
  return unique.length > 0 ? unique.join(" ") : null;
}
