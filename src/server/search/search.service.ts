import type {
  CatalogFolder,
  EquivalentCode,
  FolderColumn,
  Product,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import {
  productRepository,
  type ProductPaginationOptions,
} from "@/server/repositories/product.repository";
import { columnFilterService } from "@/server/filters/column-filter.service";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import { productImageService } from "@/server/services/product-image.service";
import { CatalogError } from "@/server/services/catalog.errors";
import { ProductError } from "@/server/services/product.errors";
import { VisibilityError } from "@/server/services/visibility.errors";
import { visibilityService } from "@/server/services/visibility.service";
import { SearchError } from "./search.errors";
import {
  resolveGloballySearchableKeys,
  resolveSearchableKeys,
} from "./search-config.resolver";
import {
  isCodeLikeQuery,
  normalizeSearchTerm,
  normalizeTextContains,
} from "./search-normalizer";
import type {
  CatalogSearchResponse,
  GlobalFieldFilter,
  GlobalSearchResponse,
  GlobalSearchScope,
  SearchMatchType,
  SearchQueryMeta,
  SearchResultItem,
} from "./search.types";

type ProductWithRelations = Product & {
  equivalentCodes?: EquivalentCode[];
  folder?: CatalogFolder & {
    catalog?: { id: string; name: string };
  };
};

export type BuildFolderProductWhereInput = {
  folderId: string;
  folderIds?: never;
  query?: string;
  searchableKeys: string[];
  filters?: ColumnFilterInput[];
  columns: FolderColumn[];
  globalFieldFilter?: GlobalFieldFilter;
};

export type BuildMultiFolderProductWhereInput = {
  folderIds: string[];
  folderId?: never;
  query?: string;
  searchableKeys: string[];
  globallySearchableKeys?: string[];
  filters?: ColumnFilterInput[];
  columns: FolderColumn[];
  globalFieldFilter?: GlobalFieldFilter;
};

function buildSearchQueryMeta(query: string): SearchQueryMeta {
  return {
    query,
    normalizedQuery: normalizeSearchTerm(query),
  };
}

function buildTextSearchConditions(
  textTerm: string,
  searchableKeys: string[],
): Prisma.ProductWhereInput[] {
  const conditions: Prisma.ProductWhereInput[] = [
    {
      description: {
        contains: textTerm,
        mode: "insensitive",
      },
    },
    {
      indexedText: {
        contains: textTerm,
        mode: "insensitive",
      },
    },
    {
      primaryCode: {
        contains: textTerm,
        mode: "insensitive",
      },
    },
  ];

  for (const key of searchableKeys) {
    conditions.push({
      dynamicData: {
        path: [key],
        string_contains: textTerm,
      },
    });
  }

  return conditions;
}

function buildCodeSearchConditions(normalizedQuery: string): Prisma.ProductWhereInput[] {
  return [
    { normalizedCode: normalizedQuery },
    { normalizedCode: { startsWith: normalizedQuery } },
    {
      equivalentCodes: {
        some: {
          OR: [
            { normalizedCode: normalizedQuery },
            { normalizedCode: { startsWith: normalizedQuery } },
          ],
        },
      },
    },
  ];
}

export function buildProductSearchWhere(
  query: string,
  searchableKeys: string[],
): Prisma.ProductWhereInput | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedQuery = normalizeSearchTerm(trimmed);
  const textTerm = normalizeTextContains(trimmed);
  const orConditions: Prisma.ProductWhereInput[] = [];

  if (normalizedQuery) {
    orConditions.push(...buildCodeSearchConditions(normalizedQuery));
  }

  if (!isCodeLikeQuery(trimmed) || textTerm.length > normalizedQuery.length) {
    orConditions.push(...buildTextSearchConditions(textTerm, searchableKeys));
  }

  if (orConditions.length === 0) {
    return null;
  }

  return { OR: orConditions };
}

export function buildFolderProductWhere(
  input: BuildFolderProductWhereInput | BuildMultiFolderProductWhereInput,
): Prisma.ProductWhereInput {
  const andConditions: Prisma.ProductWhereInput[] = [];

  if ("folderId" in input && input.folderId) {
    andConditions.push({ folderId: input.folderId });
  } else if (input.folderIds && input.folderIds.length > 0) {
    andConditions.push({ folderId: { in: input.folderIds } });
  } else {
    andConditions.push({ id: { in: [] } });
  }

  if (input.query?.trim()) {
    const keys =
      input.globallySearchableKeys && input.globallySearchableKeys.length > 0
        ? [...new Set([...input.searchableKeys, ...input.globallySearchableKeys])]
        : input.searchableKeys;
    const searchWhere = buildProductSearchWhere(input.query, keys);
    if (searchWhere) {
      andConditions.push(searchWhere);
    }
  }

  if (input.filters && input.filters.length > 0) {
    andConditions.push(columnFilterService.buildFilterWhere(input.filters, input.columns));
  }

  if (input.globalFieldFilter) {
    andConditions.push(
      columnFilterService.buildGlobalFieldFilterWhere(
        input.columns,
        input.globalFieldFilter.globalFieldKey,
        input.globalFieldFilter.value,
      ),
    );
  }

  if (andConditions.length === 1) {
    return andConditions[0]!;
  }

  return { AND: andConditions };
}

function inferMatchType(
  product: ProductWithRelations,
  query: string,
  searchableKeys: string[],
): { matchType: SearchMatchType; matchValue: string } {
  const trimmed = query.trim();
  const normalizedQuery = normalizeSearchTerm(trimmed);
  const textTerm = normalizeTextContains(trimmed).toLowerCase();

  if (
    product.normalizedCode === normalizedQuery ||
    product.primaryCode?.toLowerCase().includes(textTerm)
  ) {
    return {
      matchType: "primaryCode",
      matchValue: product.primaryCode ?? normalizedQuery,
    };
  }

  const equivalence = product.equivalentCodes?.find(
    (code) =>
      code.normalizedCode === normalizedQuery ||
      code.normalizedCode.startsWith(normalizedQuery),
  );
  if (equivalence) {
    return {
      matchType: "equivalence",
      matchValue: equivalence.originalCode,
    };
  }

  if (product.description?.toLowerCase().includes(textTerm)) {
    return {
      matchType: "description",
      matchValue: product.description,
    };
  }

  const dynamicData =
    typeof product.dynamicData === "object" &&
    product.dynamicData !== null &&
    !Array.isArray(product.dynamicData)
      ? (product.dynamicData as Record<string, unknown>)
      : {};

  for (const key of searchableKeys) {
    const value = dynamicData[key];
    if (value !== null && value !== undefined) {
      const text = String(value);
      if (text.toLowerCase().includes(textTerm)) {
        return { matchType: "column", matchValue: text };
      }
    }
  }

  if (product.indexedText?.toLowerCase().includes(textTerm)) {
    return {
      matchType: "indexedText",
      matchValue: trimmed,
    };
  }

  return {
    matchType: "indexedText",
    matchValue: trimmed,
  };
}

async function mapSearchItems(
  products: ProductWithRelations[],
  query: string,
  searchableKeys: string[],
): Promise<SearchResultItem[]> {
  const productIds = products.map((product) => product.id);
  const primaryImages =
    await productImageService.resolvePrimaryImagesForProducts(productIds);

  return products.map((product) => {
    const folder = product.folder;
    const catalog = folder?.catalog;
    const { matchType, matchValue } = inferMatchType(product, query, searchableKeys);

    return {
      productId: product.id,
      primaryCode: product.primaryCode,
      description: product.description,
      matchType,
      matchValue,
      catalog: {
        id: catalog?.id ?? "",
        name: catalog?.name ?? "",
      },
      folder: {
        id: folder?.id ?? product.folderId,
        name: folder?.name ?? "",
      },
      primaryImage: primaryImages.get(product.id) ?? null,
    };
  });
}

export class SearchService {
  buildFolderProductWhere(input: BuildFolderProductWhereInput): Prisma.ProductWhereInput {
    return buildFolderProductWhere(input);
  }

  async searchInCatalog(input: {
    catalogId: string;
    query: string;
    page?: number;
    pageSize?: number;
  }): Promise<CatalogSearchResponse> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const catalog = await catalogRepository.findById(input.catalogId);
    if (!catalog || catalog.status !== "ACTIVE") {
      throw new SearchError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
    }

    try {
      visibilityService.assertCatalogVisibleForRole(catalog, role);
    } catch (error) {
      if (error instanceof VisibilityError) {
        throw new SearchError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
      }
      throw error;
    }

    const query = input.query.trim();
    if (!query) {
      throw new SearchError("La consulta de búsqueda es obligatoria.", "VALIDATION_ERROR");
    }

    const folders = await folderRepository.findByCatalogIdOrdered(
      catalog.id,
      visibilityService.folderWhereForRole(role),
    );
    const folderIds = folders.map((folder) => folder.id);

    if (folderIds.length === 0) {
      return {
        catalog: { id: catalog.id, name: catalog.name },
        search: buildSearchQueryMeta(query),
        items: [],
        pagination: {
          page: 1,
          pageSize: input.pageSize ?? 50,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const columnsByFolder = await Promise.all(
      folderIds.map(async (folderId) => ({
        folderId,
        columns: await columnRepository.findByFolderIdOrdered(
          folderId,
          visibilityService.columnWhereForRole(role),
        ),
      })),
    );

    const searchableKeys = [
      ...new Set(
        columnsByFolder.flatMap(({ folderId, columns }) => {
          const folder = folders.find((item) => item.id === folderId);
          if (!folder) {
            return [];
          }
          return resolveSearchableKeys(folder, columns);
        }),
      ),
    ];

    const pagination: ProductPaginationOptions = {
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 50,
    };

    const where = buildFolderProductWhere({
      folderIds,
      query,
      searchableKeys,
      columns: columnsByFolder.flatMap((entry) => entry.columns),
    });

    const paginated = await productRepository.findPaginated(where, pagination);

    return {
      catalog: { id: catalog.id, name: catalog.name },
      search: buildSearchQueryMeta(query),
      items: await mapSearchItems(
        paginated.items as ProductWithRelations[],
        query,
        searchableKeys,
      ),
      pagination: {
        page: paginated.page,
        pageSize: paginated.pageSize,
        total: paginated.total,
        totalPages: paginated.totalPages,
      },
    };
  }

  async searchGlobal(input: {
    query: string;
    page?: number;
    pageSize?: number;
    scope?: GlobalSearchScope;
    globalFieldFilter?: GlobalFieldFilter;
  }): Promise<GlobalSearchResponse> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const query = input.query.trim();
    if (!query && !input.globalFieldFilter?.value.trim()) {
      throw new SearchError(
        "Debe indicar una consulta o un filtro global.",
        "VALIDATION_ERROR",
      );
    }

    let folderIds: string[] = [];

    if (input.scope?.folderId) {
      const folder = await folderRepository.findById(input.scope.folderId);
      if (!folder) {
        throw new SearchError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
      }

      const catalog = await catalogRepository.findById(folder.catalogId);
      if (!catalog || catalog.status !== "ACTIVE") {
        throw new SearchError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
      }

      try {
        visibilityService.assertCatalogVisibleForRole(catalog, role);
        visibilityService.assertFolderVisibleForRole(folder, role);
      } catch (error) {
        if (error instanceof VisibilityError) {
          throw new SearchError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
        }
        throw error;
      }

      folderIds = [folder.id];
    } else if (input.scope?.catalogId) {
      const catalog = await catalogRepository.findById(input.scope.catalogId);
      if (!catalog || catalog.status !== "ACTIVE") {
        throw new SearchError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
      }

      try {
        visibilityService.assertCatalogVisibleForRole(catalog, role);
      } catch (error) {
        if (error instanceof VisibilityError) {
          throw new SearchError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
        }
        throw error;
      }

      const folders = await folderRepository.findByCatalogIdOrdered(
        catalog.id,
        visibilityService.folderWhereForRole(role),
      );
      folderIds = folders.map((folder) => folder.id);
    } else {
      const catalogs = await catalogRepository.findActiveOrdered(
        visibilityService.catalogWhereForRole(role),
      );
      const folderGroups = await Promise.all(
        catalogs.map((catalog) =>
          folderRepository.findByCatalogIdOrdered(
            catalog.id,
            visibilityService.folderWhereForRole(role),
          ),
        ),
      );
      folderIds = folderGroups.flatMap((folders) => folders.map((folder) => folder.id));
    }

    if (folderIds.length === 0) {
      return {
        search: buildSearchQueryMeta(query || input.globalFieldFilter?.value || ""),
        items: [],
        pagination: {
          page: input.page ?? 1,
          pageSize: input.pageSize ?? 50,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const columnsByFolder = await Promise.all(
      folderIds.map(async (folderId) => ({
        folderId,
        columns: await columnRepository.findByFolderIdOrdered(
          folderId,
          visibilityService.columnWhereForRole(role),
        ),
      })),
    );

    const allColumns = columnsByFolder.flatMap((entry) => entry.columns);
    const globallySearchableKeys = resolveGloballySearchableKeys(allColumns);

    let globalFieldColumns = allColumns;
    if (input.globalFieldFilter) {
      globalFieldColumns = await columnRepository.findByGlobalFieldKey(
        input.globalFieldFilter.globalFieldKey,
        {
          folderId: { in: folderIds },
          isGloballyFilterable: true,
        },
      );
    }

    const searchableKeys = [
      ...new Set([
        ...globallySearchableKeys,
        ...columnsByFolder.flatMap(({ folderId, columns }) => {
          const folder = { id: folderId } as CatalogFolder;
          return resolveSearchableKeys(folder, columns);
        }),
      ]),
    ];

    const pagination: ProductPaginationOptions = {
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 50,
    };

    const where = buildFolderProductWhere({
      folderIds,
      query: query || undefined,
      searchableKeys,
      globallySearchableKeys,
      columns: input.globalFieldFilter ? globalFieldColumns : allColumns,
      globalFieldFilter: input.globalFieldFilter,
    });

    const paginated = await productRepository.findPaginated(where, pagination);

    return {
      search: buildSearchQueryMeta(query || input.globalFieldFilter?.value || ""),
      items: await mapSearchItems(
        paginated.items as ProductWithRelations[],
        query || input.globalFieldFilter?.value || "",
        searchableKeys,
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

export const searchService = new SearchService();

export function mapCatalogError(error: unknown): SearchError | null {
  if (error instanceof CatalogError && error.code === "CATALOG_NOT_FOUND") {
    return new SearchError(error.message, "CATALOG_NOT_FOUND");
  }

  if (error instanceof ProductError && error.code === "FOLDER_NOT_FOUND") {
    return new SearchError(error.message, "FOLDER_NOT_FOUND");
  }

  return null;
}
