export type CatalogNavigationFolderItem = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  visibleToNormalUser: boolean;
  productCount: number;
  updatedAt: string;
};

export type CatalogNavigationResponse = {
  catalog: {
    id: string;
    name: string;
    description: string | null;
    coverImageUrl: string | null;
    order: number;
    visibleToNormalUser: boolean;
    updatedAt: string;
  };
  folders: CatalogNavigationFolderItem[];
  generatedAt: string;
};
