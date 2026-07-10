import type { PriceListStatus } from "@/generated/prisma/client";
import { requireAuth, requireAdmin } from "@/server/auth";
import {
  priceListRepository,
  type PriceListWithItemCount,
  type ReorderPriceListItem,
} from "@/server/repositories/price-list.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { PriceListError } from "./price-list.errors";
import { uploadedFileRetentionService } from "./uploaded-file-retention";
import { visibilityService } from "./visibility.service";

const VALID_PRICE_LIST_STATUSES: PriceListStatus[] = ["ACTIVE", "INACTIVE"];

import { dateToIsoDateOnly, isoDateOnlyToDate } from "@/shared/utils/date-only";

export type CreatePriceListInput = {
  name: string;
  description?: string | null;
  status?: PriceListStatus;
  order?: number;
  visibleToNormalUser?: boolean;
  supplierName?: string | null;
  supplierDate?: string | null;
};

export type UpdatePriceListInput = {
  id: string;
  name?: string;
  description?: string | null;
  status?: PriceListStatus;
  visibleToNormalUser?: boolean;
  supplierName?: string | null;
  supplierDate?: string | null;
};

export type ReorderPriceListsInput = {
  items: ReorderPriceListItem[];
};

function assertPriceListStatus(status: PriceListStatus): void {
  if (!VALID_PRICE_LIST_STATUSES.includes(status)) {
    throw new PriceListError("Estado de lista inválido.", "INVALID_STATUS");
  }
}

async function requirePriceList(id: string): Promise<PriceListWithItemCount> {
  const list = await priceListRepository.findByIdWithItemCount(id);
  if (!list) {
    throw new PriceListError("Lista de precios no encontrada.", "PRICE_LIST_NOT_FOUND");
  }
  return list;
}

async function assertUniqueName(name: string, excludeId?: string): Promise<void> {
  const count = await priceListRepository.countByName(name, excludeId);
  if (count > 0) {
    throw new PriceListError(
      "Ya existe una lista de precios con ese nombre.",
      "PRICE_LIST_DUPLICATE_NAME",
    );
  }
}

async function handlePriceListWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (priceListRepository.isUniqueConstraintError(error)) {
      throw new PriceListError(
        "Ya existe una lista de precios con ese nombre.",
        "PRICE_LIST_DUPLICATE_NAME",
      );
    }
    throw error;
  }
}

export class PriceListService {
  async listPriceLists(): Promise<PriceListWithItemCount[]> {
    const { profile } = await requireAuth();
    const where = visibilityService.priceListWhereForRole(profile.role);
    return priceListRepository.findAllOrdered(where);
  }

  async getPriceList(id: string): Promise<PriceListWithItemCount> {
    const { profile } = await requireAuth();
    const list = await requirePriceList(id);
    visibilityService.assertPriceListVisibleForRole(list, profile.role);
    return list;
  }

  async createPriceList(input: CreatePriceListInput): Promise<PriceListWithItemCount> {
    const { profile: admin } = await requireAdmin();

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new PriceListError("El nombre es obligatorio.", "VALIDATION_ERROR");
    }

    if (input.status !== undefined) {
      assertPriceListStatus(input.status);
    }

    await assertUniqueName(trimmedName);

    const order =
      input.order !== undefined
        ? input.order
        : await priceListRepository.getNextOrder();

    const list = await handlePriceListWrite(() =>
      priceListRepository.create({
        name: trimmedName,
        description: input.description?.trim() || null,
        status: input.status,
        order,
        visibleToNormalUser: input.visibleToNormalUser,
        supplierName: input.supplierName?.trim() || null,
        supplierDate: input.supplierDate ? isoDateOnlyToDate(input.supplierDate) : null,
      }),
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_LIST_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_LIST,
      entityId: list.id,
    });

    return { ...list, itemCount: 0 };
  }

  async updatePriceList(input: UpdatePriceListInput): Promise<PriceListWithItemCount> {
    const { profile: admin } = await requireAdmin();
    const existing = await requirePriceList(input.id);

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new PriceListError("El nombre es obligatorio.", "VALIDATION_ERROR");
      }
      if (trimmedName !== existing.name) {
        await assertUniqueName(trimmedName, input.id);
      }
    }

    if (input.status !== undefined) {
      assertPriceListStatus(input.status);
    }

    const updated = await handlePriceListWrite(() =>
      priceListRepository.update(input.id, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.visibleToNormalUser !== undefined
          ? { visibleToNormalUser: input.visibleToNormalUser }
          : {}),
        ...(input.supplierName !== undefined
          ? { supplierName: input.supplierName?.trim() || null }
          : {}),
        ...(input.supplierDate !== undefined
          ? {
              supplierDate: input.supplierDate
                ? isoDateOnlyToDate(input.supplierDate)
                : null,
            }
          : {}),
      }),
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_LIST_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_LIST,
      entityId: updated.id,
    });

    return { ...updated, itemCount: existing.itemCount };
  }

  async deletePriceList(id: string): Promise<void> {
    const { profile: admin } = await requireAdmin();
    await requirePriceList(id);
    await uploadedFileRetentionService.purgeFilesForPriceList(id);
    await priceListRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_LIST_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_LIST,
      entityId: id,
    });
  }

  async clearPriceList(id: string): Promise<{ deletedCount: number }> {
    const { profile: admin } = await requireAdmin();
    await requirePriceList(id);
    const deletedCount = await priceListRepository.clearItems(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_LIST_CLEARED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_LIST,
      entityId: id,
    });

    return { deletedCount };
  }

  async reorderPriceLists(input: ReorderPriceListsInput): Promise<void> {
    await requireAdmin();
    if (input.items.length === 0) {
      return;
    }
    await priceListRepository.reorder(input.items);
  }

  async requirePriceListForAdmin(id: string): Promise<PriceListWithItemCount> {
    await requireAdmin();
    return requirePriceList(id);
  }
}

export const priceListService = new PriceListService();
