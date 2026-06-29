"use client";

import { CustomDropdown } from "@/features/catalog/components/CustomDropdown";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import { formatPriceListMeta, formatPriceListUpdatedAt } from "@/features/prices/utils/format-price-list-meta";
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
  const selectedList = sortedLists.find((list) => list.id === selectedListId) ?? null;

  const options = sortedLists.map((list) => ({
    id: list.id,
    label: list.name,
    description: list.description ?? undefined,
    meta: formatPriceListMeta(list.itemCount, list.updatedAt),
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

      {selectedList ? (
        <>
          <div className={styles.metaChips}>
            <span
              className={`${styles.metaChip} ${
                selectedList.visibleToNormalUser
                  ? styles.metaChipVisible
                  : styles.metaChipHidden
              }`}
            >
              {selectedList.visibleToNormalUser ? "Visible" : "Oculta"}
            </span>
            <span
              className={`${styles.metaChip} ${
                selectedList.status === "ACTIVE"
                  ? styles.metaChipActive
                  : styles.metaChipInactive
              }`}
            >
              {selectedList.status === "ACTIVE" ? "Activa" : "Inactiva"}
            </span>
            <span className={`${styles.metaChip} ${styles.metaChipAmber}`}>
              {selectedList.itemCount.toLocaleString("es-AR")} ítems
            </span>
            <span className={`${styles.metaChip} ${styles.metaChipUpdated}`}>
              Actualizado {formatPriceListUpdatedAt(selectedList.updatedAt)}
            </span>
          </div>
          {selectedList.description ? (
            <p className={styles.listDescription}>{selectedList.description}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
