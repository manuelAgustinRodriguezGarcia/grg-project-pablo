import type { FolderColumn } from "@/generated/prisma/client";

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

export type ProductTableItem = {
  id: string;
  primaryCode: string | null;
  description: string | null;
  dynamicData: Record<string, unknown>;
  primaryImage: ProductTablePrimaryImage | null;
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
