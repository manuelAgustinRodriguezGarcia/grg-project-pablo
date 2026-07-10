/**
 * Shared TanStack Query key factories for admin data fetching.
 * Prefer prefix invalidation (e.g. adminQueryKeys.products()) over
 * embedding reload tokens in keys.
 */

export const adminQueryKeys = {
  all: ["admin"] as const,

  navigation: (catalogId: string) =>
    ["admin", "navigation", catalogId] as const,

  products: (
    folderId?: string,
    page?: number,
    serializedFilters?: string,
    search?: string,
  ) => {
    if (folderId === undefined) {
      return ["admin", "products"] as const;
    }

    return [
      "admin",
      "products",
      folderId,
      page,
      serializedFilters,
      search,
    ] as const;
  },

  globalSearch: (query: string, pageSize: number) =>
    ["admin", "global-search", query, pageSize] as const,

  priceColumns: (listId?: string) =>
    listId === undefined
      ? (["admin", "price-columns"] as const)
      : (["admin", "price-columns", listId] as const),

  priceItems: (
    listId?: string,
    page?: number,
    search?: string,
    serializedFilters?: string,
  ) => {
    if (listId === undefined) {
      return ["admin", "price-items"] as const;
    }

    return [
      "admin",
      "price-items",
      listId,
      page,
      search,
      serializedFilters,
    ] as const;
  },

  files: (page?: number, query?: string) => {
    if (page === undefined) {
      return ["admin", "files"] as const;
    }

    return ["admin", "files", page, query] as const;
  },
} as const;
