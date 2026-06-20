import type { FolderColumn } from "@/generated/prisma/client";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import {
  productRepository,
  type PaginatedProducts,
} from "@/server/repositories/product.repository";
import { ProductError } from "./product.errors";
import { VisibilityError } from "./visibility.errors";
import { visibilityService } from "./visibility.service";

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

export type ListProductsInput = {
  folderId: string;
  page?: number;
  pageSize?: number;
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
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
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

    return {
      folder: {
        id: folder.id,
        name: folder.name,
        catalogId: folder.catalogId,
      },
      columns,
      products: paginated.items.map((product) =>
        toProductTableItem(product, visibleColumnKeys, role),
      ),
      pagination: {
        page: paginated.page,
        pageSize: paginated.pageSize,
        total: paginated.total,
        totalPages: paginated.totalPages,
      },
    };
  }
}

export const productService = new ProductService();
