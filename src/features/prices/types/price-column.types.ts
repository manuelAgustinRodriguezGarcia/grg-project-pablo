export type PriceColumnListItem = {
  id: string;
  priceListId: string;
  originalName: string;
  displayName: string;
  internalKey: string;
  dataType: string;
  order: number;
  visibleToNormalUser: boolean;
  isSearchable: boolean;
  isFilterable: boolean;
  isAdminEditable: boolean;
  isReadOnly: boolean;
  isPrimaryCode: boolean;
  isDescription: boolean;
  isPrice: boolean;
  helpText: string | null;
};

export type PriceColumnsResponse = {
  columns: PriceColumnListItem[];
};
