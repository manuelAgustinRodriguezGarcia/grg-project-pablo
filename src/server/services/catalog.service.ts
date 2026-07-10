import type { CatalogStatus } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth";
import {
  catalogRepository,
  type CatalogWithFolderCount,
} from "@/server/repositories/catalog.repository";
import { deleteFile, uploadFile } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { StorageError } from "@/server/storage/errors";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { CatalogError } from "./catalog.errors";
import { uploadedFileRetentionService } from "./uploaded-file-retention";

const VALID_CATALOG_STATUSES: CatalogStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "HIDDEN",
];

export type CreateCatalogInput = {
  name: string;
  description?: string | null;
  status?: CatalogStatus;
  order?: number;
  visibleToNormalUser?: boolean;
};

export type UpdateCatalogInput = {
  id: string;
  name?: string;
  description?: string | null;
  status?: CatalogStatus;
};

export type ReorderCatalogsInput = {
  items: Array<{ id: string; order: number }>;
};

export type SetCoverImageInput = {
  catalogId: string;
  body: Buffer;
  contentType: string;
  originalFilename: string;
};

function assertCatalogStatus(status: CatalogStatus): void {
  if (!VALID_CATALOG_STATUSES.includes(status)) {
    throw new CatalogError("Estado de catálogo inválido.", "INVALID_STATUS");
  }
}

async function requireCatalog(id: string): Promise<CatalogWithFolderCount> {
  const catalog = await catalogRepository.findByIdWithFolderCount(id);
  if (!catalog) {
    throw new CatalogError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
  }
  return catalog;
}

async function deleteCoverImageBestEffort(
  coverImagePath: string | null,
): Promise<void> {
  if (!coverImagePath) {
    return;
  }

  try {
    await deleteFile(STORAGE_BUCKETS.PRODUCT_IMAGES, coverImagePath);
  } catch (error) {
    console.error(
      "[CatalogService] No se pudo eliminar la imagen de portada:",
      error,
    );
  }
}

export class CatalogService {
  async listCatalogs(): Promise<CatalogWithFolderCount[]> {
    await requireAdmin();
    return catalogRepository.findAllOrderedWithFolderCount();
  }

  async getCatalog(id: string): Promise<CatalogWithFolderCount> {
    await requireAdmin();
    return requireCatalog(id);
  }

  async createCatalog(input: CreateCatalogInput): Promise<CatalogWithFolderCount> {
    const { profile: admin } = await requireAdmin();

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new CatalogError("El nombre es obligatorio.", "VALIDATION_ERROR");
    }

    if (input.status !== undefined) {
      assertCatalogStatus(input.status);
    }

    const order =
      input.order !== undefined
        ? input.order
        : await catalogRepository.getNextOrder();

    const catalog = await catalogRepository.create({
      name: trimmedName,
      description: input.description?.trim() || null,
      status: input.status,
      order,
      visibleToNormalUser: input.visibleToNormalUser,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.CATALOG_CREATED,
      entityType: AUDIT_ENTITY_TYPES.CATALOG,
      entityId: catalog.id,
    });

    return {
      ...catalog,
      folderCount: 0,
    };
  }

  async updateCatalog(input: UpdateCatalogInput): Promise<CatalogWithFolderCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireCatalog(input.id);

    if (input.name !== undefined && !input.name.trim()) {
      throw new CatalogError("El nombre no puede estar vacío.", "VALIDATION_ERROR");
    }

    if (input.status !== undefined) {
      assertCatalogStatus(input.status);
    }

    const hasChanges =
      input.name !== undefined ||
      input.description !== undefined ||
      input.status !== undefined;

    if (!hasChanges) {
      return existing;
    }

    const catalog = await catalogRepository.update(input.id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.CATALOG_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.CATALOG,
      entityId: catalog.id,
    });

    return {
      ...catalog,
      folderCount: existing.folderCount,
    };
  }

  async reorderCatalogs(
    input: ReorderCatalogsInput,
  ): Promise<CatalogWithFolderCount[]> {
    const { profile: admin } = await requireAdmin();

    if (input.items.length === 0) {
      throw new CatalogError(
        "Debes indicar al menos un catálogo para reordenar.",
        "VALIDATION_ERROR",
      );
    }

    const ids = input.items.map((item) => item.id);
    const existing = await catalogRepository.findManyByIds(ids);

    if (existing.length !== ids.length) {
      throw new CatalogError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
    }

    await catalogRepository.reorder(input.items);

    for (const item of input.items) {
      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.CATALOG_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.CATALOG,
        entityId: item.id,
      });
    }

    return catalogRepository.findAllOrderedWithFolderCount();
  }

  async setCatalogVisibility(
    id: string,
    visible: boolean,
  ): Promise<CatalogWithFolderCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireCatalog(id);

    if (existing.visibleToNormalUser === visible) {
      return existing;
    }

    const catalog = await catalogRepository.update(id, {
      visibleToNormalUser: visible,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.CATALOG_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.CATALOG,
      entityId: catalog.id,
    });

    return {
      ...catalog,
      folderCount: existing.folderCount,
    };
  }

  async deleteCatalog(id: string): Promise<void> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireCatalog(id);

    await deleteCoverImageBestEffort(existing.coverImagePath);
    await uploadedFileRetentionService.purgeFilesForCatalog(id);
    await catalogRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.CATALOG_DELETED,
      entityType: AUDIT_ENTITY_TYPES.CATALOG,
      entityId: id,
    });
  }

  async clearCatalog(id: string): Promise<{ deletedProductCount: number }> {
    const { profile: admin } = await requireAdmin();

    await requireCatalog(id);

    const deletedProductCount = await catalogRepository.clearProducts(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.CATALOG_CLEARED,
      entityType: AUDIT_ENTITY_TYPES.CATALOG,
      entityId: id,
    });

    return { deletedProductCount };
  }

  async setCoverImage(
    input: SetCoverImageInput,
  ): Promise<CatalogWithFolderCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireCatalog(input.catalogId);
    const previousPath = existing.coverImagePath;

    let uploadedPath: string;

    try {
      const uploaded = await uploadFile({
        bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
        path: `catalogs/${input.catalogId}/cover-${crypto.randomUUID()}`,
        body: input.body,
        contentType: input.contentType,
        originalFilename: input.originalFilename,
        upsert: false,
        auditContext: {
          userId: admin.id,
        },
      });
      uploadedPath = uploaded.path;
    } catch (error) {
      if (error instanceof StorageError) {
        throw new CatalogError(error.message, "VALIDATION_ERROR");
      }
      throw error;
    }

    const catalog = await catalogRepository.update(input.catalogId, {
      coverImagePath: uploadedPath,
    });

    if (previousPath && previousPath !== uploadedPath) {
      await deleteCoverImageBestEffort(previousPath);
    }

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.CATALOG_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.CATALOG,
      entityId: catalog.id,
    });

    return {
      ...catalog,
      folderCount: existing.folderCount,
    };
  }

  async removeCoverImage(id: string): Promise<CatalogWithFolderCount> {
    const { profile: admin } = await requireAdmin();

    const existing = await requireCatalog(id);

    if (!existing.coverImagePath) {
      return existing;
    }

    await deleteCoverImageBestEffort(existing.coverImagePath);

    const catalog = await catalogRepository.update(id, {
      coverImagePath: null,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.CATALOG_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.CATALOG,
      entityId: catalog.id,
    });

    return {
      ...catalog,
      folderCount: existing.folderCount,
    };
  }
}

export const catalogService = new CatalogService();
