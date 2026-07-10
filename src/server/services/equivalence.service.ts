import type { FolderColumn } from "@/generated/prisma/client";
import { normalizeCodeForMatch } from "@/server/importers/match-detector";
import { requireRole } from "@/server/auth";
import { equivalentCodeRepository } from "@/server/repositories/equivalent-code.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import {
  collectEquivalenceTokensFromColumns,
  parseEquivalenceText,
} from "./equivalence.parser";
import { EquivalenceError } from "./equivalence.errors";

export type EquivalenceListItem = {
  id: string;
  productId: string;
  originalCode: string;
  normalizedCode: string;
  sourceColumnKey: string | null;
  createdAt: string;
  updatedAt: string;
};

function toListItem(code: {
  id: string;
  productId: string;
  originalCode: string;
  normalizedCode: string;
  sourceColumnKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EquivalenceListItem {
  return {
    id: code.id,
    productId: code.productId,
    originalCode: code.originalCode,
    normalizedCode: code.normalizedCode,
    sourceColumnKey: code.sourceColumnKey,
    createdAt: code.createdAt.toISOString(),
    updatedAt: code.updatedAt.toISOString(),
  };
}

async function assertProductExists(productId: string): Promise<void> {
  const product = await productRepository.findById(productId);
  if (!product) {
    throw new EquivalenceError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
  }
}

function resolveSourceColumnKey(
  columns: FolderColumn[],
  dynamicData: Record<string, unknown>,
  normalizedCode: string,
): string | null {
  const sourceColumn = columns.find((column) => {
    if (!column.isEquivalence) {
      return false;
    }

    const value = dynamicData[column.internalKey];
    if (value === null || value === undefined) {
      return false;
    }

    return parseEquivalenceText(String(value)).some(
      (parsed) => parsed.normalizedCode === normalizedCode,
    );
  });

  return sourceColumn?.internalKey ?? null;
}

export class EquivalenceService {
  /**
   * Builds the unique equivalence rows for one product without touching the DB.
   * Used by both single-product sync and bulk folder/import sync.
   */
  buildRowsForProduct(
    productId: string,
    columns: FolderColumn[],
    dynamicData: Record<string, unknown>,
  ): Array<{
    productId: string;
    originalCode: string;
    normalizedCode: string;
    sourceColumnKey: string | null;
  }> {
    const equivalenceColumns = columns.filter((column) => column.isEquivalence);
    const tokens = collectEquivalenceTokensFromColumns(equivalenceColumns, dynamicData);

    if (tokens.length === 0) {
      return [];
    }

    const uniqueByNormalized = new Map<
      string,
      { originalCode: string; normalizedCode: string; sourceColumnKey: string | null }
    >();

    for (const token of tokens) {
      if (uniqueByNormalized.has(token.normalizedCode)) {
        continue;
      }

      uniqueByNormalized.set(token.normalizedCode, {
        originalCode: token.originalCode,
        normalizedCode: token.normalizedCode,
        sourceColumnKey: resolveSourceColumnKey(
          equivalenceColumns,
          dynamicData,
          token.normalizedCode,
        ),
      });
    }

    return [...uniqueByNormalized.values()].map((token) => ({
      productId,
      originalCode: token.originalCode,
      normalizedCode: token.normalizedCode,
      sourceColumnKey: token.sourceColumnKey,
    }));
  }

  async syncFromProduct(
    productId: string,
    columns: FolderColumn[],
    dynamicData: Record<string, unknown>,
  ): Promise<EquivalenceListItem[]> {
    await equivalentCodeRepository.deleteByProductId(productId);

    const rows = this.buildRowsForProduct(productId, columns, dynamicData);

    if (rows.length === 0) {
      return [];
    }

    await equivalentCodeRepository.createMany(rows);

    return (await equivalentCodeRepository.findByProductId(productId)).map(toListItem);
  }

  /**
   * Replaces all equivalence codes for the given products in two queries
   * (deleteMany + createMany) instead of 3×N per-product round-trips.
   */
  async syncManyFromProducts(
    products: Array<{
      id: string;
      dynamicData: Record<string, unknown>;
    }>,
    columns: FolderColumn[],
  ): Promise<void> {
    if (products.length === 0) {
      return;
    }

    const productIds = products.map((product) => product.id);
    const rows = products.flatMap((product) =>
      this.buildRowsForProduct(product.id, columns, product.dynamicData),
    );

    await equivalentCodeRepository.deleteByProductIds(productIds);

    if (rows.length > 0) {
      await equivalentCodeRepository.createMany(rows);
    }
  }

  async listByProduct(productId: string): Promise<EquivalenceListItem[]> {
    await requireRole("ADMIN");
    await assertProductExists(productId);

    const codes = await equivalentCodeRepository.findByProductId(productId);
    return codes.map(toListItem);
  }

  async addManual(productId: string, originalCode: string): Promise<EquivalenceListItem> {
    const { profile: admin } = await requireRole("ADMIN");
    await assertProductExists(productId);

    const trimmed = originalCode.trim();
    if (!trimmed) {
      throw new EquivalenceError("El código no puede estar vacío.", "VALIDATION_ERROR");
    }

    const normalizedCode = normalizeCodeForMatch(trimmed);
    const existing = await equivalentCodeRepository.findByProductId(productId);
    if (existing.some((code) => code.normalizedCode === normalizedCode)) {
      throw new EquivalenceError("El código ya existe en el producto.", "DUPLICATE_CODE");
    }

    await equivalentCodeRepository.createMany([
      {
        productId,
        originalCode: trimmed,
        normalizedCode,
        sourceColumnKey: null,
      },
    ]);

    const created = (await equivalentCodeRepository.findByProductId(productId)).find(
      (code) => code.normalizedCode === normalizedCode,
    );

    if (!created) {
      throw new EquivalenceError("No se pudo crear la equivalencia.", "VALIDATION_ERROR");
    }

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.EQUIVALENCE_ADDED,
      entityType: AUDIT_ENTITY_TYPES.EQUIVALENT_CODE,
      entityId: created.id,
    });

    return toListItem(created);
  }

  async remove(equivalenceId: string, productId: string): Promise<void> {
    const { profile: admin } = await requireRole("ADMIN");
    await assertProductExists(productId);

    const code = await equivalentCodeRepository.findByIdAndProduct(
      equivalenceId,
      productId,
    );

    if (!code) {
      throw new EquivalenceError("Equivalencia no encontrada.", "EQUIVALENCE_NOT_FOUND");
    }

    await equivalentCodeRepository.deleteById(code.id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.EQUIVALENCE_REMOVED,
      entityType: AUDIT_ENTITY_TYPES.EQUIVALENT_CODE,
      entityId: code.id,
    });
  }

  async copyToProduct(sourceProductId: string, targetProductId: string): Promise<number> {
    return equivalentCodeRepository.copyToProduct(sourceProductId, targetProductId);
  }
}

export const equivalenceService = new EquivalenceService();
