export type PriceItemTableColumn = {
  id: string;
  internalKey: string;
  displayName: string;
  originalName: string;
  dataType: string;
  visibleToNormalUser: boolean;
  isPrimaryCode: boolean;
  isDescription: boolean;
  isPrice: boolean;
  hasContextualHelp: boolean;
};

export type PriceItemTableRow = {
  id: string;
  primaryCode: string | null;
  description: string | null;
  amount: string | null;
  dynamicData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PriceItemTableResponse = {
  priceList: {
    id: string;
    name: string;
  };
  columns: PriceItemTableColumn[];
  items: PriceItemTableRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
