import type { ProductFieldAnnotation } from "@/generated/prisma/client";
import {
  normalizeColumnHelpImageAltText,
  normalizeColumnHelpText,
} from "./column-help.utils";
import { ProductFieldAnnotationError } from "./product-field-annotation.errors";

export type ProductFieldAnnotationResolved = {
  columnInternalKey: string;
  helpText: string | null;
  helpImageAltText: string | null;
  thumbnailUrl: string | null;
  fullUrl: string | null;
  hasAnnotation: boolean;
};

export type ProductFieldAnnotationDisplay = {
  helpText: string | null;
  thumbnailUrl: string | null;
  fullUrl: string | null;
};

const HELP_TEXT_MAX_LENGTH = 2000;
const HELP_IMAGE_ALT_MAX_LENGTH = 200;

export function normalizeFieldHelpText(value: string | null | undefined): string | null {
  return normalizeColumnHelpText(value);
}

export function assertFieldHelpTextLength(value: string | null | undefined): string | null {
  if (value !== null && value !== undefined && value.trim().length > HELP_TEXT_MAX_LENGTH) {
    throw new ProductFieldAnnotationError(
      "El texto descriptivo no puede superar 2000 caracteres.",
      "VALIDATION_ERROR",
    );
  }

  return normalizeFieldHelpText(value);
}

export function normalizeFieldHelpImageAltText(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeColumnHelpImageAltText(value);
  if (normalized && normalized.length > HELP_IMAGE_ALT_MAX_LENGTH) {
    throw new Error("El texto alternativo no puede superar 200 caracteres.");
  }

  return normalized;
}

export function hasFieldAnnotation(
  annotation: Pick<ProductFieldAnnotation, "helpText" | "helpImagePath">,
): boolean {
  return (
    normalizeColumnHelpText(annotation.helpText) !== null ||
    Boolean(annotation.helpImagePath)
  );
}

export function toAnnotationDisplay(
  annotation: ProductFieldAnnotationResolved,
): ProductFieldAnnotationDisplay {
  return {
    helpText: annotation.helpText,
    thumbnailUrl: annotation.thumbnailUrl,
    fullUrl: annotation.fullUrl,
  };
}
