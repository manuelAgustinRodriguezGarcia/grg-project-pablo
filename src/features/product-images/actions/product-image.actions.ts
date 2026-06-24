"use server";

import { AuthError } from "@/server/auth";
import { ProductImageError } from "@/server/services/product-image.errors";
import { productImageService } from "@/server/services/product-image.service";
import {
  productImageIdParamSchema,
  updateProductImageInputSchema,
} from "@/features/records/schemas/product.schemas";
import type {
  ProductImageActionResult,
  ProductImageReviewItem,
} from "@/features/product-images/types/product-image.types";

function toActionError(error: unknown): ProductImageActionResult<never> {
  if (error instanceof ProductImageError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof Error) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function uploadProductImageAction(
  input: FormData,
): Promise<ProductImageActionResult<ProductImageReviewItem>> {
  const productId = input.get("productId");
  const file = input.get("file");

  if (typeof productId !== "string" || !(file instanceof File)) {
    return {
      success: false,
      error: "Debe enviar productId y file.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPrimaryRaw = input.get("isPrimary");
    const sortOrderRaw = input.get("sortOrder");
    const labelRaw = input.get("label");

    const image = await productImageService.uploadManualImage({
      productId,
      buffer,
      originalFilename: file.name,
      isPrimary: isPrimaryRaw === "true" ? true : undefined,
      sortOrder:
        typeof sortOrderRaw === "string" && sortOrderRaw.length > 0
          ? Number.parseInt(sortOrderRaw, 10)
          : undefined,
      label: typeof labelRaw === "string" ? labelRaw : undefined,
    });

    return { success: true, data: image };
  } catch (error) {
    return toActionError(error);
  }
}

export async function replaceProductImageAction(
  input: FormData,
): Promise<ProductImageActionResult<ProductImageReviewItem>> {
  const productId = input.get("productId");
  const imageId = input.get("imageId");
  const file = input.get("file");

  if (
    typeof productId !== "string" ||
    typeof imageId !== "string" ||
    !(file instanceof File)
  ) {
    return {
      success: false,
      error: "Debe enviar productId, imageId y file.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await productImageService.replaceManualImage({
      productId,
      imageId,
      buffer,
      originalFilename: file.name,
    });

    return { success: true, data: image };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProductImageAction(
  input: unknown,
): Promise<ProductImageActionResult<ProductImageReviewItem>> {
  const parsed = updateProductImageInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const image = await productImageService.updateProductImage({
      productId: parsed.data.productId,
      imageId: parsed.data.imageId,
      isPrimary: parsed.data.isPrimary,
      sortOrder: parsed.data.sortOrder,
      label: parsed.data.label,
    });

    return { success: true, data: image };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProductImageAction(
  input: unknown,
): Promise<ProductImageActionResult<undefined>> {
  const parsed = productImageIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await productImageService.deleteProductImage(parsed.data.productId, parsed.data.imageId);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
