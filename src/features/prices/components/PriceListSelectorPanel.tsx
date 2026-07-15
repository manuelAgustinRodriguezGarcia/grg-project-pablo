"use client";

import { CustomDropdown } from "@/features/catalog/components/CustomDropdown";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import { formatPriceListMeta } from "@/features/prices/utils/format-price-list-meta";
import { sortByName } from "@/features/catalog/utils/sortByName";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceListSelectorPanelProps = {
  priceLists: PriceListListItem[];
  selectedListId: string;
  onSelectList: (id: string) => void;
  onAddList?: () => void;
  onEditList?: (id: string) => void;
  onDeleteList?: (id: string) => void;
};

export function PriceListSelectorPanel({
  priceLists,
  selectedListId,
  onSelectList,
  onAddList,
  onEditList,
  onDeleteList,
}: PriceListSelectorPanelProps) {
  const sortedLists = sortByName(priceLists);

  const options = sortedLists.map((list) => ({
    id: list.id,
    label: list.name,
    meta: formatPriceListMeta(list.itemCount),
  }));

  return (
    <section className={styles.selectionPanel} aria-label="Lista de precios">
      <CustomDropdown
        label="Lista de precios"
        options={options}
        selectedId={selectedListId}
        onSelect={onSelectList}
        onAdd={onAddList}
        onOptionEdit={onEditList}
        onOptionDelete={onDeleteList}
        emptyMessage="Sin listas de precios"
        placeholder="Seleccioná una lista"
        preferPlaceholderWithoutOptions
      />
    </section>
  );
}
