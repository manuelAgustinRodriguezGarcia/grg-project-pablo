export type DirectoryOfflineSyncStatus = "unavailable";

export type DirectoryCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  sectionCount: number;
  updatedAt: string;
  order: number;
  offlineSync: {
    status: DirectoryOfflineSyncStatus;
  };
};

export type DirectoryResponse = {
  catalogs: DirectoryCatalogItem[];
  generatedAt: string;
};
