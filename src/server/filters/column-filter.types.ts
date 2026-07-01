export type ColumnFilterOperator = "contains" | "equals";

export type ColumnFilterInput = {
  columnInternalKey: string;
  operator: ColumnFilterOperator;
  value: string;
};

export type JsonTextColumnFilter = ColumnFilterInput;

export type ActiveFilterPill = {
  id: string;
  columnInternalKey: string;
  columnDisplayName: string;
  operator: ColumnFilterOperator;
  value: string;
  label: string;
};
