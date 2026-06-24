import type { FolderColumn } from "@/generated/prisma/client";
import { requireAuth, requireRole } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import {
  productRepository,
  type PaginatedProducts,
} from "@/server/repositories/product.repository";
import { productImageRepository } from "@/server/repositories/product-image.repository";
import { deleteFile } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { ProductError } from "./product.errors";
import { productImageService } from "./product-image.service";
import { VisibilityError } from "./visibility.errors";
import { visibilityService } from "./visibility.service";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import {
  buildProductFields,
  productToFieldValues,
} from "./product-field.builder";
import { equivalenceService } from "./equivalence.service";
import type { EquivalenceListItem } from "./equivalence.service";

export type ProductTableFolder = {
  id: string;
  name: string;
  catalogId: string;
};

export type ProductTableItem = {
  id: string;
  primaryCode: string | null;
  description: string | null;
  dynamicData: Record<string, unknown>;
  primaryImage: {
    id: string;
    thumbnailUrl: string | null;
    fullUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProductTableResponse = {
  folder: ProductTableFolder;
  columns: FolderColumn[];
  products: ProductTableItem[];
  pagination: ProductTablePagination;
};

export type ProductDetail = ProductTableItem & {
  folderId: string;
  equivalences: EquivalenceListItem[];
};

export type ListProductsInput = {
  folderId: string;
  page?: number;
  pageSize?: number;
};

export type MutateProductInput = {
  values: Record<string, unknown>;
};

export type CreateProductInput = {
  folderId: string;
  values: Record<string, unknown>;
};

export type UpdateProductInput = {
  productId: string;
  values: Record<string, unknown>;
};

function parseDynamicData(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toProductTableItem(
  product: PaginatedProducts["items"][number],
  visibleColumnKeys: Iterable<string>,
  role: "ADMIN" | "CONSULTA",
  primaryImage: ProductTableItem["primaryImage"],
): ProductTableItem {
  const dynamicData = visibilityService.stripHiddenDynamicData(
    parseDynamicData(product.dynamicData),
    visibleColumnKeys,
    role,
  );

  return {
    id: product.id,
    primaryCode: product.primaryCode,
    description: product.description,
    dynamicData,
    primaryImage,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function getEditableColumns(folderId: string): Promise<FolderColumn[]> {
  return columnRepository.findByFolderIdOrdered(folderId);
}

async function assertFolderForAdmin(folderId: string) {
  const folder = await folderRepository.findById(folderId);
  if (!folder) {
    throw new ProductError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
  }

  const catalog = await catalogRepository.findById(folder.catalogId);
  if (!catalog) {
    throw new ProductError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
  }

  return { folder, catalog };
}

async function deleteProductImagesBestEffort(productId: string): Promise<void> {
  const images = await productImageRepository.findByProduct(productId);

  for (const image of images) {
    if (image.storagePath) {
      try {
        await deleteFile(STORAGE_BUCKETS.PRODUCT_IMAGES, image.storagePath);
      } catch {
        // best effort
      }
    }

    if (image.thumbnailPath) {
      try {
        await deleteFile(STORAGE_BUCKETS.PRODUCT_IMAGES, image.thumbnailPath);
      } catch {
        // best effort
      }
    }
  }
}

export class ProductService {
  async listProductsByFolder(input: ListProductsInput): Promise<ProductTableResponse> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const folder = await folderRepository.findById(input.folderId);
    if (!folder) {
      throw new ProductError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
    }

    const catalog = await catalogRepository.findById(folder.catalogId);
    if (!catalog) {
      throw new ProductError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
    }

    try {
      visibilityService.assertCatalogVisibleForRole(catalog, role);
      visibilityService.assertFolderVisibleForRole(folder, role);
    } catch (error) {
      if (error instanceof VisibilityError) {
        throw new ProductError(error.message, "FOLDER_NOT_FOUND");
      }
      throw error;
    }

    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 50;

    if (page < 1 || pageSize < 1) {
      throw new ProductError("Parámetros de paginación inválidos.", "VALIDATION_ERROR");
    }

    const columns = await columnRepository.findByFolderIdOrdered(
      folder.id,
      visibilityService.columnWhereForRole(role),
    );

    const paginated = await productRepository.findByFolderPaginated(folder.id, {
      page,
      pageSize,
    });

    const visibleColumnKeys = columns.map((column) => column.internalKey);
    const productIds = paginated.items.map((product) => product.id);
    const primaryImages =
      await productImageService.resolvePrimaryImagesForProducts(productIds);

    return {
      folder: {
        id: folder.id,
        name: folder.name,
        catalogId: folder.catalogId,
      },
      columns,
      products: paginated.items.map((product) =>
        toProductTableItem(
          product,
          visibleColumnKeys,
          role,
          primaryImages.get(product.id) ?? null,
        ),
      ),
      pagination: {
        page: paginated.page,
        pageSize: paginated.pageSize,
        total: paginated.total,
        totalPages: paginated.totalPages,
      },
    };
  }

  async getProduct(productId: string): Promise<ProductDetail> {
    const { profile } = await requireRole("ADMIN");

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new ProductError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    const { folder } = await assertFolderForAdmin(product.folderId);
    const columns = await columnRepository.findByFolderIdOrdered(folder.id);
    const primaryImages = await productImageService.resolvePrimaryImagesForProducts([
      product.id,
    ]);
    const equivalences = await equivalenceService.listByProduct(product.id);

    const item = toProductTableItem(
      product,
      columns.map((column) => column.internalKey),
      profile.role,
      primaryImages.get(product.id) ?? null,
    );

    return {
      ...item,
      folderId: product.folderId,
      equivalences,
    };
  }

  async createProduct(input: CreateProductInput): Promise<ProductDetail> {
    const { profile: admin } = await requireRole("ADMIN");
    await assertFolderForAdmin(input.folderId);

    const columns = await getEditableColumns(input.folderId);
    const editableKeys = new Set(
      columns
        .filter((column) => !column.isReadOnly && column.isAdminEditable)
        .map((column) => column.internalKey),
    );
    const values = Object.fromEntries(
      Object.entries(input.values).filter(([key]) => editableKeys.has(key)),
    );
    const built = buildProductFields(columns, { values });

    const product = await productRepository.create({
      folderId: input.folderId,
      primaryCode: built.primaryCode,
      normalizedCode: built.normalizedCode,
      description: built.description,
      dynamicData: built.dynamicData,
      originalText: built.originalText,
      indexedText: built.indexedText,
    });

    await equivalenceService.syncFromProduct(
      product.id,
      columns,
      built.dynamicData,
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT,
      entityId: product.id,
    });

    return this.getProduct(product.id);
  }

  async updateProduct(input: UpdateProductInput): Promise<ProductDetail> {
    const { profile: admin } = await requireRole("ADMIN");

    const existing = await productRepository.findById(input.productId);
    if (!existing) {
      throw new ProductError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    await assertFolderForAdmin(existing.folderId);
    const columns = await getEditableColumns(existing.folderId);
    const existingValues = productToFieldValues(existing, columns);
    const editableKeys = new Set(
      columns
        .filter((column) => !column.isReadOnly && column.isAdminEditable)
        .map((column) => column.internalKey),
    );
    const mergedValues = { ...existingValues };
    for (const [key, value] of Object.entries(input.values)) {
      if (editableKeys.has(key)) {
        mergedValues[key] = value;
      }
    }
    const built = buildProductFields(columns, { values: mergedValues });

    await productRepository.update(existing.id, {
      primaryCode: built.primaryCode,
      normalizedCode: built.normalizedCode,
      description: built.description,
      dynamicData: built.dynamicData,
      originalText: built.originalText,
      indexedText: built.indexedText,
    });

    await equivalenceService.syncFromProduct(
      existing.id,
      columns,
      built.dynamicData,
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT,
      entityId: existing.id,
    });

    return this.getProduct(existing.id);
  }

  async deleteProduct(productId: string): Promise<void> {
    const { profile: admin } = await requireRole("ADMIN");

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new ProductError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    await assertFolderForAdmin(product.folderId);
    await deleteProductImagesBestEffort(productId);
    await productRepository.delete(productId);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT,
      entityId: productId,
    });
  }

  async duplicateProduct(productId: string): Promise<ProductDetail> {
    const { profile: admin } = await requireRole("ADMIN");

    const source = await productRepository.findById(productId);
    if (!source) {
      throw new ProductError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    await assertFolderForAdmin(source.folderId);
    const columns = await getEditableColumns(source.folderId);
    const sourceValues = productToFieldValues(source, columns);
    const editableKeys = new Set(
      columns
        .filter((column) => !column.isReadOnly && column.isAdminEditable)
        .map((column) => column.internalKey),
    );
    const editableValues = Object.fromEntries(
      Object.entries(sourceValues).filter(([key]) => editableKeys.has(key)),
    );

    const primaryColumn = columns.find((column) => column.isPrimaryCode);
    if (primaryColumn && editableValues[primaryColumn.internalKey]) {
      editableValues[primaryColumn.internalKey] = `${String(
        editableValues[primaryColumn.internalKey],
      )} (copia)`;
    }

    const built = buildProductFields(columns, { values: editableValues });
    const sourceDynamicData = parseDynamicData(source.dynamicData);
    for (const column of columns) {
      if (column.isReadOnly || !column.isAdminEditable) {
        if (!column.isPrimaryCode && !column.isDescription) {
          built.dynamicData[column.internalKey] =
            sourceDynamicData[column.internalKey] ?? null;
        }
      }
    }
    const duplicate = await productRepository.create({
      folderId: source.folderId,
      primaryCode: built.primaryCode,
      normalizedCode: built.normalizedCode,
      description: built.description,
      dynamicData: built.dynamicData,
      originalText: built.originalText,
      indexedText: built.indexedText,
    });

    await equivalenceService.copyToProduct(source.id, duplicate.id);
    await productImageService.duplicateImagesForProduct(
      source.id,
      duplicate.id,
      source.folderId,
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_DUPLICATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT,
      entityId: duplicate.id,
    });

    return this.getProduct(duplicate.id);
  }

  async syncEquivalencesForFolder(folderId: string): Promise<void> {
    const columns = await getEditableColumns(folderId);
    const products = await productRepository.findByFolderId(folderId);

    for (const product of products) {
      const dynamicData = parseDynamicData(product.dynamicData);
      await equivalenceService.syncFromProduct(product.id, columns, dynamicData);
    }
  }
}

export const productService = new ProductService();
