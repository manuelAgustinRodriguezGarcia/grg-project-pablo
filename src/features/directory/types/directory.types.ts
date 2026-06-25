export type DirectoryOfflineSyncStatus = "unavailable" | "ready" | "synced";

export type DirectoryOfflineSync = {
  status: DirectoryOfflineSyncStatus;
  lastServerVersion?: number;
};

export type DirectoryCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  sectionCount: number;
  updatedAt: string;
  order: number;
  offlineSync: DirectoryOfflineSync;
};

export type DirectoryResponse = {
  catalogs: DirectoryCatalogItem[];
  generatedAt: string;
};
