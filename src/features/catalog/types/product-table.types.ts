import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type { ActiveFilterPill } from "@/server/filters/column-filter.types";
import type { SearchQueryMeta } from "@/server/search/search.types";

export type ProductTableFolder = {
  id: string;
  name: string;
  catalogId: string;
};

export type ProductTablePrimaryImage = {
  id: string;
  thumbnailUrl: string | null;
  fullUrl: string | null;
};

export type ProductFieldAnnotation = {
  helpText: string | null;
  thumbnailUrl: string | null;
  fullUrl: string | null;
};

export type ProductTableItem = {
  id: string;
  primaryCode: string | null;
  description: string | null;
  dynamicData: Record<string, unknown>;
  primaryImage: ProductTablePrimaryImage | null;
  /** Optional gallery images next to COL 0 (ZIP/primary), not tied to a data column. */
  extraImages: ProductTablePrimaryImage[];
  imagesByColumnKey: Record<string, ProductTablePrimaryImage[]>;
  fieldAnnotationsByColumnKey: Record<string, ProductFieldAnnotation>;
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
  columns: ColumnListItem[];
  products: ProductTableItem[];
  pagination: ProductTablePagination;
  search: SearchQueryMeta | null;
  activeFilters: ActiveFilterPill[];
};
