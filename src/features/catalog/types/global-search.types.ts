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

export type SearchResultItem = {
  productId: string;
  primaryCode: string | null;
  description: string | null;
  matchType: SearchMatchType;
  matchValue: string;
  catalog: {
    id: string;
    name: string;
  };
  folder: {
    id: string;
    name: string;
  };
  primaryImage: {
    id: string;
    thumbnailUrl: string | null;
    fullUrl: string | null;
  } | null;
};

export type SearchPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type GlobalSearchResponse = {
  search: SearchQueryMeta;
  items: SearchResultItem[];
  pagination: SearchPagination;
};
