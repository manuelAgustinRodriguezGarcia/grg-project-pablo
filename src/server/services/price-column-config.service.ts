import type { ColumnDataType, PriceColumn, UserRole } from "@/generated/prisma/client";
import { requireAuth, requireAdmin } from "@/server/auth";
import {
  priceColumnRepository,
  type CreatePriceColumnData,
  type ReorderPriceColumnItem,
  type UpdatePriceColumnData,
} from "@/server/repositories/price-column.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { PriceColumnConfigError } from "./price-column-config.errors";
import { visibilityService } from "./visibility.service";

const VALID_COLUMN_DATA_TYPES: ColumnDataType[] = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "FORMULA",
  "UNKNOWN",
];

export type CreatePriceColumnInput = CreatePriceColumnData;

export type UpdatePriceColumnInput = {
  id: string;
} & UpdatePriceColumnData;

export type ReorderPriceColumnsInput = {
  priceListId: string;
  items: ReorderPriceColumnItem[];
};

function assertColumnDataType(dataType: ColumnDataType): void {
  if (!VALID_COLUMN_DATA_TYPES.includes(dataType)) {
    throw new PriceColumnConfigError("Tipo de columna inválido.", "VALIDATION_ERROR");
  }
}

async function requirePriceListExists(priceListId: string): Promise<void> {
  const list = await priceListRepository.findById(priceListId);
  if (!list) {
    throw new PriceColumnConfigError(
      "Lista de precios no encontrada.",
      "PRICE_LIST_NOT_FOUND",
    );
  }
}

async function requireColumn(id: string): Promise<PriceColumn> {
  const column = await priceColumnRepository.findById(id);
  if (!column) {
    throw new PriceColumnConfigError(
      "Columna no encontrada.",
      "PRICE_COLUMN_NOT_FOUND",
    );
  }
  return column;
}

async function assertUniquePrimaryCode(
  priceListId: string,
  isPrimaryCode: boolean,
  excludeId?: string,
): Promise<void> {
  if (!isPrimaryCode) {
    return;
  }

  const count = await priceColumnRepository.countPrimaryCodeByPriceList(
    priceListId,
    excludeId,
  );
  if (count > 0) {
    throw new PriceColumnConfigError(
      "Ya existe una columna de código principal en la lista.",
      "COLUMN_PRIMARY_CODE_CONFLICT",
    );
  }
}

async function handleColumnWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (priceColumnRepository.isUniqueConstraintError(error)) {
      throw new PriceColumnConfigError(
        "Ya existe una columna con esa clave interna en la lista.",
        "COLUMN_DUPLICATE_KEY",
      );
    }
    throw error;
  }
}

export class PriceColumnConfigService {
  async listColumns(priceListId: string, role?: UserRole): Promise<PriceColumn[]> {
    if (role === undefined) {
      await requireAdmin();
      return priceColumnRepository.findByPriceListIdOrdered(priceListId);
    }

    await requireAuth();
    await requirePriceListExists(priceListId);

    return priceColumnRepository.findByPriceListIdOrdered(
      priceListId,
      visibilityService.priceColumnWhereForRole(role),
    );
  }

  async createColumn(input: CreatePriceColumnInput): Promise<PriceColumn> {
    const { profile: admin } = await requireAdmin();
    await requirePriceListExists(input.priceListId);

    const internalKey = input.internalKey.trim();
    if (!internalKey) {
      throw new PriceColumnConfigError(
        "La clave interna es obligatoria.",
        "VALIDATION_ERROR",
      );
    }

    if (input.dataType !== undefined) {
      assertColumnDataType(input.dataType);
    }

    await assertUniquePrimaryCode(input.priceListId, input.isPrimaryCode ?? false);

    const order =
      input.order !== undefined
        ? input.order
        : await priceColumnRepository.getNextOrder(input.priceListId);

    const column = await handleColumnWrite(() =>
      priceColumnRepository.create({
        ...input,
        internalKey,
        order,
      }),
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_COLUMN_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_COLUMN,
      entityId: column.id,
    });

    return column;
  }

  async updateColumn(input: UpdatePriceColumnInput): Promise<PriceColumn> {
    const { profile: admin } = await requireAdmin();
    const existing = await requireColumn(input.id);

    if (input.originalName !== undefined) {
      throw new PriceColumnConfigError(
        "El nombre original no es editable.",
        "VALIDATION_ERROR",
      );
    }

    if (input.dataType !== undefined) {
      assertColumnDataType(input.dataType);
    }

    if (input.isPrimaryCode) {
      await assertUniquePrimaryCode(existing.priceListId, true, input.id);
    }

    const column = await handleColumnWrite(() =>
      priceColumnRepository.update(input.id, {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
        ...(input.visibleToNormalUser !== undefined
          ? { visibleToNormalUser: input.visibleToNormalUser }
          : {}),
        ...(input.isSearchable !== undefined ? { isSearchable: input.isSearchable } : {}),
        ...(input.isFilterable !== undefined ? { isFilterable: input.isFilterable } : {}),
        ...(input.isAdminEditable !== undefined
          ? { isAdminEditable: input.isAdminEditable }
          : {}),
        ...(input.isPrimaryCode !== undefined ? { isPrimaryCode: input.isPrimaryCode } : {}),
        ...(input.isDescription !== undefined
          ? { isDescription: input.isDescription }
          : {}),
        ...(input.isPrice !== undefined ? { isPrice: input.isPrice } : {}),
        ...(input.helpText !== undefined ? { helpText: input.helpText } : {}),
        ...(input.helpImageAltText !== undefined
          ? { helpImageAltText: input.helpImageAltText }
          : {}),
      }),
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_COLUMN_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_COLUMN,
      entityId: column.id,
    });

    return column;
  }

  async deleteColumn(id: string): Promise<void> {
    const { profile: admin } = await requireAdmin();
    await requireColumn(id);
    await priceColumnRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_COLUMN_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_COLUMN,
      entityId: id,
    });
  }

  async reorderColumns(input: ReorderPriceColumnsInput): Promise<void> {
    await requireAdmin();
    await requirePriceListExists(input.priceListId);
    if (input.items.length === 0) {
      return;
    }
    await priceColumnRepository.reorder(input.items);
  }
}

export const priceColumnConfigService = new PriceColumnConfigService();
