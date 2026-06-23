import type { FolderColumn } from "@/generated/prisma/client";

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
