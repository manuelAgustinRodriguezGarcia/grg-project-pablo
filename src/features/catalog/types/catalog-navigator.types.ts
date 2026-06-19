export type MockColumnDataType = "text" | "number" | "date" | "image" | "boolean";

export type MockColumn = {
  id: string;
  internalKey: string;
  displayName: string;
  originalName: string;
  order: number;
  dataType: MockColumnDataType;
  visibleToNormalUser: boolean;
  isPrimaryCode?: boolean;
  isDescription?: boolean;
  isImageCode?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
};

export type MockProductValue = string | number | null;

export type MockProduct = {
  id: string;
  folderId: string;
  primaryCode: string;
  description: string;
  dynamicData: Record<string, MockProductValue>;
};

export type MockFolder = {
  id: string;
  catalogId: string;
  name: string;
  order: number;
  visibleToNormalUser: boolean;
  columns: MockColumn[];
  products: MockProduct[];
};

export type MockCatalog = {
  id: string;
  name: string;
  description: string;
  order: number;
  visibleToNormalUser: boolean;
  folders: MockFolder[];
};
