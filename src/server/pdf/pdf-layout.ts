import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { rgb } from "pdf-lib";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
export const PAGE_MARGIN = 36;

export const PDF_NAVY = rgb(0.012, 0.106, 0.239);
export const PDF_BLUE = rgb(0, 0.4, 0.851);
export const PDF_ORANGE = rgb(0.89, 0.45, 0.08);
export const PDF_GRAY = rgb(0.35, 0.4, 0.48);
export const PDF_LINE = rgb(0.82, 0.85, 0.9);
export const PDF_MUTED = rgb(0.93, 0.94, 0.96);
export const PDF_AMBER_BG = rgb(1, 0.95, 0.86);
export const PDF_AMBER = rgb(0.57, 0.25, 0.05);

export function drawPdfText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color?: RGB;
    maxWidth?: number;
  },
): void {
  const sanitized = toWinAnsi(text);
  const value =
    options.maxWidth &&
    options.font.widthOfTextAtSize(sanitized, options.size) > options.maxWidth
      ? truncateToWidth(sanitized, options.font, options.size, options.maxWidth)
      : sanitized;

  page.drawText(value, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color ?? PDF_NAVY,
  });
}

export function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const sanitized = toWinAnsi(text).trim();
  if (!sanitized) {
    return [""];
  }

  const words = sanitized.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    current = truncateToWidth(word, font, size, maxWidth);
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

export function truncateToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  const ellipsis = "...";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (
    truncated.length > 0 &&
    font.widthOfTextAtSize(`${truncated}${ellipsis}`, size) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}${ellipsis}`;
}

export function formatPdfDate(value: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export function joinLocation(
  city: string | null | undefined,
  province: string | null | undefined,
): string | null {
  const parts = [city?.trim(), province?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function drawPdfAmountCell(
  page: PDFPage,
  amount: number,
  options: {
    x: number;
    y: number;
    width: number;
    size: number;
    font: PDFFont;
    color?: RGB;
  },
): void {
  const number = formatPdfAmount(amount);
  const dollarWidth = options.font.widthOfTextAtSize("$", options.size);
  const numberWidth = options.font.widthOfTextAtSize(
    toWinAnsi(number),
    options.size,
  );
  const gap = Math.max(4, options.size * 0.5);
  const numberX = options.x + options.width - numberWidth;
  const dollarX =
    numberX < options.x + dollarWidth + gap
      ? numberX - dollarWidth - gap
      : options.x;

  drawPdfText(page, "$", {
    x: dollarX,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color,
  });
  drawPdfText(page, number, {
    x: numberX,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color,
  });
}
