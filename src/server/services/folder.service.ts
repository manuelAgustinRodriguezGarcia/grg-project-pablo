import type { FolderStatus } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import {
  folderRepository,
  type FolderColumnKeysConfig,
  type FolderWithProductCount,
} from "@/server/repositories/folder.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { FolderError } from "./folder.errors";
import { uploadedFileRetentionService } from "./uploaded-file-retention";

const VALID_FOLDER_STATUSES: FolderStatus[] = ["ACTIVE", "INACTIVE"];

const MAX_COLUMN_KEYS = 100;

export type CreateFolderInput = {
  catalogId: string;
  name: string;
  description?: string | null;
  status?: FolderStatus;
  order?: number;
  visibleToNormalUser?: boolean;
};

export type CreateFolderFromSheetInput = {
  catalogId: string;
  sheetName: string;
  description?: string | null;
};

export type UpdateFolderInput = {
  id: string;
  name?: string;
  description?: string | null;
  status?: FolderStatus;
};

export type ReorderFoldersInput = {
  catalogId: string;
  items: Array<{ id: string; order: number }>;
};

function assertFolderStatus(status: FolderStatus): void {
  if (!VALID_FOLDER_STATUSES.includes(status)) {
    throw new FolderError("Estado de carpeta inválido.", "INVALID_STATUS");
  }
}

function validateColumnKeysConfig(
  config: FolderColumnKeysConfig | null,
): FolderColumnKeysConfig | null {
  if (config === null) {
    return null;
  }

  if (!Array.isArray(config.columnInternalKeys)) {
    throw new FolderError(
      "La configuración debe incluir columnInternalKeys.",
      "VALIDATION_ERROR",
    );
  }

  if (config.columnInternalKeys.length > MAX_COLUMN_KEYS) {
    throw new FolderError(
      `No se pueden configurar más de ${MAX_COLUMN_KEYS} columnas.`,
      "VALIDATION_ERROR",
    );
  }

  const normalizedKeys = config.columnInternalKeys.map((key) => key.trim());

  if (normalizedKeys.some((key) => !key)) {
    throw new FolderError(
      "Las claves de columna no pueden estar vacías.",
      "VALIDATION_ERROR",
    );
  }

  const uniqueKeys = new Set(normalizedKeys);
  if (uniqueKeys.size !== normalizedKeys.length) {
    throw new FolderError(
      "Las claves de columna no pueden repetirse.",
      "VALIDATION_ERROR",
    );
  }

  return { columnInternalKeys: normalizedKeys };
}

async function requireCatalogExists(catalogId: string): Promise<void> {
  const catalog = await catalogRepository.findById(catalogId);
  if (!catalog) {
    throw new FolderError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
  }
}

async function requireFolder(id: string): Promise<FolderWithProductCount> {
  const folder = await folderRepository.findByIdWithProductCount(id);
  if (!folder) {
    throw new FolderError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
  }
  return folder;
}

async function assertUniqueFolderName(
  catalogId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const count = await folderRepository.countByCatalogAndName(
    catalogId,
    name,
    excludeId,
  );

  if (count > 0) {
    throw new FolderError(
      "Ya existe una carpeta con ese nombre en el catálogo.",
      "FOLDER_DUPLICATE_NAME",
    );
  }
}

async function handleFolderWrite<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (folderRepository.isUniqueConstraintError(error)) {
      throw new FolderError(
        "Ya existe una carpeta con ese nombre en el catálogo.",
        "FOLDER_DUPLICATE_NAME",
      );
    }
    throw error;
  }
}

export class FolderService {
  async listFolders(catalogId: string): Promise<FolderWithProductCount[]> {
    await requireAdmin();
    await requireCatalogExists(catalogId);
    return folderRepository.findByCatalogIdOrdered(catalogId);
  }

  async getFolder(id: string): Promise<FolderWithProductCount> {
    await requireAdmin();
    return requireFolder(id);
  }

  async createFolder(input: CreateFolderInput): Promise<FolderWithProductCount> {
    const { profile: admin } = await requireAdmin();

    await requireCatalogExists(input.catalogId);

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new FolderError("El nombre es obligatorio.", "VALIDATION_ERROR");
    }

    if (input.status !== undefined) {
      assertFolderStatus(input.status);
    }

    await assertUniqueFolderName(input.catalogId, trimmedName);

    const order =
      input.order !== undefined
        ? input.order
        : await folderRepository.getNextOrder(input.catalogId);

    const folder = await handleFolderWrite(() =>
      folderRepository.create({
        catalogId: input.catalogId,
        name: trimmedName,
        description: input.description?.trim() || null,
        status: input.status,
        order,
        visibleToNormalUser: input.visibleToNormalUser,
      }),
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FOLDER_CREATED,
      entityType: AUDIT_ENTITY_TYPES.FOLDER,
      entityId: folder.id,
    });

    return {
      ...folder,
      productCount: 0,
    };
  }

  async createFolderFromSheet(
    input: CreateFolderFromSheetInput,
  ): Promise<FolderWithProductCount> {
    return this.createFolder({
      catalogId: input.catalogId,
      name: input.sheetName,
      description: input.description,
    });
  }

  async updateFolder(input: UpdateFolderInput): Promise<FolderWithProductCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireFolder(input.id);

    if (input.name !== undefined && !input.name.trim()) {
      throw new FolderError("El nombre no puede estar vacío.", "VALIDATION_ERROR");
    }

    if (input.status !== undefined) {
      assertFolderStatus(input.status);
    }

    const hasChanges =
      input.name !== undefined ||
      input.description !== undefined ||
      input.status !== undefined;

    if (!hasChanges) {
      return existing;
    }

    const nextName =
      input.name !== undefined ? input.name.trim() : existing.name;

    if (input.name !== undefined && nextName !== existing.name) {
      await assertUniqueFolderName(existing.catalogId, nextName, existing.id);
    }

    const folder = await handleFolderWrite(() =>
      folderRepository.update(input.id, {
        ...(input.name !== undefined ? { name: nextName } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      }),
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FOLDER_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.FOLDER,
      entityId: folder.id,
    });

    return {
      ...folder,
      productCount: existing.productCount,
    };
  }

  async reorderFolders(
    input: ReorderFoldersInput,
  ): Promise<FolderWithProductCount[]> {
    const { profile: admin } = await requireAdmin();

    await requireCatalogExists(input.catalogId);

    if (input.items.length === 0) {
      throw new FolderError(
        "Debes indicar al menos una carpeta para reordenar.",
        "VALIDATION_ERROR",
      );
    }

    const ids = input.items.map((item) => item.id);
    const existing = await folderRepository.findManyByIds(ids);

    if (existing.length !== ids.length) {
      throw new FolderError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
    }

    const invalidCatalog = existing.some(
      (folder) => folder.catalogId !== input.catalogId,
    );

    if (invalidCatalog) {
      throw new FolderError(
        "Una o más carpetas no pertenecen al catálogo indicado.",
        "VALIDATION_ERROR",
      );
    }

    await folderRepository.reorder(input.items);

    for (const item of input.items) {
      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.FOLDER_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.FOLDER,
        entityId: item.id,
      });
    }

    return folderRepository.findByCatalogIdOrdered(input.catalogId);
  }

  async setFolderVisibility(
    id: string,
    visible: boolean,
  ): Promise<FolderWithProductCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireFolder(id);

    if (existing.visibleToNormalUser === visible) {
      return existing;
    }

    const folder = await folderRepository.update(id, {
      visibleToNormalUser: visible,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FOLDER_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.FOLDER,
      entityId: folder.id,
    });

    return {
      ...folder,
      productCount: existing.productCount,
    };
  }

  async deleteFolder(id: string): Promise<void> {
    const { profile: admin } = await requireAdmin();

    await requireFolder(id);

    await uploadedFileRetentionService.purgeFilesForFolder(id);
    await folderRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FOLDER_DELETED,
      entityType: AUDIT_ENTITY_TYPES.FOLDER,
      entityId: id,
    });
  }

  async clearFolder(id: string): Promise<{ deletedProductCount: number }> {
    const { profile: admin } = await requireAdmin();

    await requireFolder(id);

    const deletedProductCount = await folderRepository.clearProducts(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FOLDER_CLEARED,
      entityType: AUDIT_ENTITY_TYPES.FOLDER,
      entityId: id,
    });

    return { deletedProductCount };
  }

  async setFolderSearchConfig(
    id: string,
    config: FolderColumnKeysConfig | null,
  ): Promise<FolderWithProductCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireFolder(id);
    const validatedConfig = validateColumnKeysConfig(config);

    const folder = await folderRepository.update(id, {
      searchConfig: validatedConfig,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FOLDER_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.FOLDER,
      entityId: folder.id,
    });

    return {
      ...folder,
      productCount: existing.productCount,
    };
  }

  async setFolderFilterConfig(
    id: string,
    config: FolderColumnKeysConfig | null,
  ): Promise<FolderWithProductCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireFolder(id);
    const validatedConfig = validateColumnKeysConfig(config);

    const folder = await folderRepository.update(id, {
      filterConfig: validatedConfig,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FOLDER_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.FOLDER,
      entityId: folder.id,
    });

    return {
      ...folder,
      productCount: existing.productCount,
    };
  }
}

export const folderService = new FolderService();

export type { FolderColumnKeysConfig };
