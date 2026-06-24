"use server";

import { AuthError } from "@/server/auth";
import { EquivalenceError } from "@/server/services/equivalence.errors";
import { equivalenceService } from "@/server/services/equivalence.service";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";
import {
  addEquivalenceInputSchema,
  createProductInputSchema,
  equivalenceIdParamSchema,
  productIdParamSchema,
  updateProductInputSchema,
} from "@/features/records/schemas/product.schemas";
import type {
  EquivalenceListItem,
  ProductActionResult,
  ProductDetail,
} from "@/features/records/types/product.types";

function toActionError(error: unknown): ProductActionResult<never> {
  if (error instanceof ProductError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof EquivalenceError) {
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

export async function getProductAction(
  input: unknown,
): Promise<ProductActionResult<ProductDetail>> {
  const parsed = productIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const product = await productService.getProduct(parsed.data.productId);
    return { success: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createProductAction(
  input: unknown,
): Promise<ProductActionResult<ProductDetail>> {
  const parsed = createProductInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const product = await productService.createProduct({
      folderId: parsed.data.folderId,
      values: parsed.data.values,
    });
    return { success: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProductAction(
  input: unknown,
): Promise<ProductActionResult<ProductDetail>> {
  const parsed = updateProductInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const product = await productService.updateProduct({
      productId: parsed.data.productId,
      values: parsed.data.values,
    });
    return { success: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProductAction(
  input: unknown,
): Promise<ProductActionResult<undefined>> {
  const parsed = productIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await productService.deleteProduct(parsed.data.productId);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function duplicateProductAction(
  input: unknown,
): Promise<ProductActionResult<ProductDetail>> {
  const parsed = productIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const product = await productService.duplicateProduct(parsed.data.productId);
    return { success: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listEquivalencesAction(
  input: unknown,
): Promise<ProductActionResult<EquivalenceListItem[]>> {
  const parsed = productIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const equivalences = await equivalenceService.listByProduct(parsed.data.productId);
    return { success: true, data: equivalences };
  } catch (error) {
    return toActionError(error);
  }
}

export async function addEquivalenceAction(
  input: unknown,
): Promise<ProductActionResult<EquivalenceListItem>> {
  const parsed = addEquivalenceInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const equivalence = await equivalenceService.addManual(
      parsed.data.productId,
      parsed.data.originalCode,
    );
    return { success: true, data: equivalence };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeEquivalenceAction(
  input: unknown,
): Promise<ProductActionResult<undefined>> {
  const parsed = equivalenceIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await equivalenceService.remove(parsed.data.equivalenceId, parsed.data.productId);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
