"use client";

import { ImportSearchableSelect } from "./ImportSearchableSelect";

export type ProductSearchOption = {
  id: string;
  label: string;
};

type ProductSearchComboboxProps = {
  options: ProductSearchOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ProductSearchCombobox({
  options,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = "Buscar producto…",
}: ProductSearchComboboxProps) {
  return (
    <ImportSearchableSelect
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
      }))}
      value={selectedId}
      onChange={onSelect}
      disabled={disabled}
      placeholder={placeholder}
      listboxLabel="Productos"
      clearOnQueryChange
    />
  );
}
