import type { Worksheet } from "exceljs";
import type { DetectedHeader, EmbeddedImageSummary } from "./types";

type AnchorPoint = {
  nativeRow?: number;
  nativeCol?: number;
  nativeRowOff?: number;
  nativeColOff?: number;
  row?: number;
  col?: number;
};

export type EmbeddedImageAnchor = {
  imageId: number;
  sheetName: string;
  row: number;
  col: number;
  nativeRow: number | null;
  nativeCol: number | null;
  nativeRowOff: number;
  nativeColOff: number;
  columnHeader: string | null;
  sourceIndex: number;
  placementKey: string;
};

export type SheetImageStats = {
  totalCount: number;
  byRow: Record<number, number>;
};

function resolveColumnHeader(
  headers: DetectedHeader[] | undefined,
  colIndex: number,
): string | null {
  if (!headers) {
    return null;
  }

  const header = headers.find((item) => item.columnIndex === colIndex);
  return header?.originalName ?? null;
}

export function resolveEmbeddedImageRow(
  range: { tl?: AnchorPoint } | undefined,
): number | null {
  const tl = range?.tl;
  if (!tl) {
    return null;
  }

  if (typeof tl.nativeRow === "number") {
    return tl.nativeRow + 1;
  }

  if (typeof tl.row === "number") {
    return Math.floor(tl.row) + 1;
  }

  return null;
}

export function resolveEmbeddedImageCol(
  range: { tl?: AnchorPoint } | undefined,
): number {
  const tl = range?.tl;
  if (!tl) {
    return 0;
  }

  if (typeof tl.nativeCol === "number") {
    return tl.nativeCol;
  }

  if (typeof tl.col === "number") {
    return Math.floor(tl.col);
  }

  return 0;
}

function readAnchorOffsets(range: { tl?: AnchorPoint } | undefined): {
  nativeRowOff: number;
  nativeColOff: number;
  nativeRow: number | null;
  nativeCol: number | null;
} {
  const tl = range?.tl;

  return {
    nativeRowOff: typeof tl?.nativeRowOff === "number" ? tl.nativeRowOff : 0,
    nativeColOff: typeof tl?.nativeColOff === "number" ? tl.nativeColOff : 0,
    nativeRow: typeof tl?.nativeRow === "number" ? tl.nativeRow : null,
    nativeCol: typeof tl?.nativeCol === "number" ? tl.nativeCol : null,
  };
}

export function listEmbeddedImageAnchors(
  worksheet: Worksheet,
  headers?: DetectedHeader[],
): EmbeddedImageAnchor[] {
  const images = worksheet.getImages?.() ?? [];
  const anchors: EmbeddedImageAnchor[] = [];

  images.forEach((image, sourceIndex) => {
    const imageId = Number(image.imageId);
    if (Number.isNaN(imageId)) {
      return;
    }

    const row = resolveEmbeddedImageRow(image.range);
    if (row === null) {
      return;
    }

    const col = resolveEmbeddedImageCol(image.range);
    const offsets = readAnchorOffsets(image.range);

    anchors.push({
      imageId,
      sheetName: worksheet.name,
      row,
      col,
      nativeRow: offsets.nativeRow,
      nativeCol: offsets.nativeCol,
      nativeRowOff: offsets.nativeRowOff,
      nativeColOff: offsets.nativeColOff,
      columnHeader: resolveColumnHeader(headers, col),
      sourceIndex,
      placementKey: `${imageId}:${row}:${col}:${sourceIndex}`,
    });
  });

  return anchors;
}

export function compareEmbeddedImageAnchors(
  left: EmbeddedImageAnchor,
  right: EmbeddedImageAnchor,
): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  if (left.col !== right.col) {
    return left.col - right.col;
  }

  if (left.nativeRowOff !== right.nativeRowOff) {
    return left.nativeRowOff - right.nativeRowOff;
  }

  if (left.nativeColOff !== right.nativeColOff) {
    return left.nativeColOff - right.nativeColOff;
  }

  return left.sourceIndex - right.sourceIndex;
}

export function sortEmbeddedImageAnchors(
  anchors: EmbeddedImageAnchor[],
): EmbeddedImageAnchor[] {
  return [...anchors].sort(compareEmbeddedImageAnchors);
}

export function buildSheetImageStats(
  anchors: EmbeddedImageAnchor[],
): SheetImageStats {
  const byRow: Record<number, number> = {};

  for (const anchor of anchors) {
    byRow[anchor.row] = (byRow[anchor.row] ?? 0) + 1;
  }

  return {
    totalCount: anchors.length,
    byRow,
  };
}

export function buildEmbeddedImageSummary(
  anchors: EmbeddedImageAnchor[],
): EmbeddedImageSummary {
  const stats = buildSheetImageStats(anchors);
  const rowsWithMultiple = Object.values(stats.byRow).filter((count) => count > 1).length;

  return {
    embeddedImagesDetected: stats.totalCount,
    rowsWithEmbeddedImages: Object.keys(stats.byRow).length,
    productsWithMultipleEmbeddedImages: rowsWithMultiple,
  };
}

export function detectSheetImages(worksheet: Worksheet): SheetImageStats {
  return buildSheetImageStats(listEmbeddedImageAnchors(worksheet));
}
