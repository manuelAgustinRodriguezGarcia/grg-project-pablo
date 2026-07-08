import type { CatalogFolder, EquivalentCode, FolderColumn, Product } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import {
  productRepository,
  type ProductPaginationOptions,
  type ProductSearchResult,
} from "@/server/repositories/product.repository";
import { columnFilterService } from "@/server/filters/column-filter.service";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import { productImageService } from "@/server/services/product-image.service";
import { CatalogError } from "@/server/services/catalog.errors";
import { ProductError } from "@/server/services/product.errors";
import { VisibilityError } from "@/server/services/visibility.errors";
import { visibilityService } from "@/server/services/visibility.service";
import { SearchError } from "./search.errors";
import { resolveSearchableKeys } from "./search-config.resolver";
import {
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

const GLOBAL_ENTITY_LIMIT = 25;
const MIN_GLOBAL_QUERY_CHARS = 2;

export type BuildFolderProductWhereInput = {
  folderId: string;
  folderIds?: never;
  query?: string;
  searchableKeys?: string[];
  globallySearchableKeys?: string[];
  filters?: ColumnFilterInput[];
  columns: FolderColumn[];
  globalFieldFilter?: GlobalFieldFilter;
};

export type BuildMultiFolderProductWhereInput = {
  folderIds: string[];
  folderId?: never;
  query?: string;
  searchableKeys?: string[];
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

function buildTextSearchConditions(textTerm: string): Prisma.ProductWhereInput[] {
  return [
    {
      indexedText: {
        contains: textTerm,
        mode: "insensitive",
      },
    },
    {
      originalText: {
        contains: textTerm,
        mode: "insensitive",
      },
    },
  ];
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

  // Siempre buscamos también en el texto indexado (código, descripción y
  // valores de columnas). Antes se omitía para consultas de una sola palabra
  // sin separadores (p. ej. "INDIEL"), lo que impedía encontrar coincidencias
  // en descripción o columnas cuando el término no era el código primario.
  if (textTerm) {
    orConditions.push(...buildTextSearchConditions(textTerm));
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
    const searchWhere = buildProductSearchWhere(input.query);
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
  product: ProductWithRelations | ProductSearchResult,
  query: string,
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

  for (const value of Object.values(dynamicData)) {
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
  products: Array<ProductWithRelations | ProductSearchResult>,
  query: string,
): Promise<SearchResultItem[]> {
  const productIds = products.map((product) => product.id);
  const primaryImages =
    await productImageService.resolvePrimaryImagesForProducts(productIds);

  return products.map((product) => {
    const folder = product.folder;
    const catalog = folder?.catalog;
    const { matchType, matchValue } = inferMatchType(product, query);

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
    const hasQuery = query.length > 0;
    if (!query && !input.globalFieldFilter?.value.trim()) {
      throw new SearchError(
        "Debe indicar una consulta o un filtro global.",
        "VALIDATION_ERROR",
      );
    }

    if (hasQuery && query.length < MIN_GLOBAL_QUERY_CHARS) {
      throw new SearchError(
        `La consulta debe tener al menos ${MIN_GLOBAL_QUERY_CHARS} caracteres.`,
        "VALIDATION_ERROR",
      );
    }

    let folderIds: string[] = [];
    const isScoped = Boolean(input.scope?.folderId || input.scope?.catalogId);

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

      folderIds = await folderRepository.findIdsByCatalogId(
        catalog.id,
        visibilityService.folderWhereForRole(role),
      );
    } else {
      folderIds = await folderRepository.findAccessibleIds(
        visibilityService.catalogWhereForRole(role),
        visibilityService.folderWhereForRole(role),
      );
    }

    let globalFieldColumns: FolderColumn[] = [];
    if (input.globalFieldFilter) {
      globalFieldColumns = await columnRepository.findByGlobalFieldKey(
        input.globalFieldFilter.globalFieldKey,
        {
          folderId: { in: folderIds },
          isGloballyFilterable: true,
        },
      );
    }

    const pagination: ProductPaginationOptions = {
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 50,
    };

    const where = buildFolderProductWhere({
      folderIds,
      query: query || undefined,
      columns: globalFieldColumns,
      globalFieldFilter: input.globalFieldFilter,
    });

    const searchText = query || input.globalFieldFilter?.value || "";
    const shouldSearchEntities = hasQuery && !isScoped;
    const [catalogMatches, folderMatches, paginated] = await Promise.all([
      shouldSearchEntities
        ? catalogRepository.findMatching(
            query,
            visibilityService.catalogWhereForRole(role),
            GLOBAL_ENTITY_LIMIT,
          )
        : Promise.resolve([]),
      shouldSearchEntities
        ? folderRepository.findMatching(query, folderIds, GLOBAL_ENTITY_LIMIT)
        : Promise.resolve([]),
      folderIds.length > 0
        ? productRepository.findSearchPaginated(where, pagination)
        : Promise.resolve({
            items: [],
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: 0,
            totalPages: 0,
          }),
    ]);

    return {
      search: buildSearchQueryMeta(searchText),
      catalogs: catalogMatches.map((catalog) => ({
        catalogId: catalog.id,
        name: catalog.name,
        description: catalog.description,
      })),
      folders: folderMatches.map((folder) => ({
        folderId: folder.id,
        name: folder.name,
        description: folder.description,
        catalog: {
          id: folder.catalog.id,
          name: folder.catalog.name,
        },
      })),
      items: await mapSearchItems(paginated.items, searchText),
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
