export type SearchMatchType =
  | "primaryCode"
  | "equivalence"
  | "description"
  | "indexedText"
  | "column";

export type SearchQueryMeta = {
  query: string;
  normalizedQuery: string;
};

export type SearchResultOrigin = {
  catalog: {
    id: string;
    name: string;
  };
  folder: {
    id: string;
    name: string;
  };
};

export type SearchResultItem = {
  productId: string;
  primaryCode: string | null;
  description: string | null;
  matchType: SearchMatchType;
  matchValue: string;
  catalog: SearchResultOrigin["catalog"];
  folder: SearchResultOrigin["folder"];
  primaryImage: {
    id: string;
    thumbnailUrl: string | null;
    fullUrl: string | null;
  } | null;
};

export type CatalogSearchHit = {
  catalogId: string;
  name: string;
  description: string | null;
};

export type FolderSearchHit = {
  folderId: string;
  name: string;
  description: string | null;
  catalog: {
    id: string;
    name: string;
  };
};

export type SearchPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CatalogSearchResponse = {
  catalog: {
    id: string;
    name: string;
  };
  search: SearchQueryMeta;
  items: SearchResultItem[];
  pagination: SearchPagination;
};

export type GlobalSearchResponse = {
  search: SearchQueryMeta;
  catalogs: CatalogSearchHit[];
  folders: FolderSearchHit[];
  items: SearchResultItem[];
  pagination: SearchPagination;
};

export type GlobalSearchScope = {
  catalogId?: string;
  folderId?: string;
};

export type GlobalFieldFilter = {
  globalFieldKey: string;
  value: string;
};
