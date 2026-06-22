import type { Worksheet } from "exceljs";

export type SheetImageStats = {
  totalCount: number;
  byRow: Record<number, number>;
};

export function detectSheetImages(worksheet: Worksheet): SheetImageStats {
  const byRow: Record<number, number> = {};
  let totalCount = 0;

  const images = worksheet.getImages?.() ?? [];

  for (const image of images) {
    totalCount += 1;
    const range = image.range;
    const row =
      typeof range?.tl?.nativeRow === "number"
        ? range.tl.nativeRow + 1
        : typeof range?.tl?.row === "number"
          ? range.tl.row
          : undefined;

    if (row !== undefined) {
      byRow[row] = (byRow[row] ?? 0) + 1;
    }
  }

  return { totalCount, byRow };
}
