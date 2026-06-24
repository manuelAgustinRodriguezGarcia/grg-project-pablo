import type { FolderColumn } from "@/generated/prisma/client";

export type ColumnHelpResolvedUrls = {
  helpImagePreviewUrl: string | null;
  helpImageFullUrl: string | null;
};

function normalizeHelpText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasContextualHelp(
  column: Pick<FolderColumn, "helpText" | "helpImagePath">,
): boolean {
  return normalizeHelpText(column.helpText) !== null || Boolean(column.helpImagePath);
}

export function normalizeColumnHelpText(value: string | null | undefined): string | null {
  return normalizeHelpText(value);
}

export function normalizeColumnHelpImageAltText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
