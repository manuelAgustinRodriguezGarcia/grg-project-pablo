export function formatPriceListMeta(itemCount: number): string {
  return itemCount === 1 ? "1 ítem" : `${itemCount.toLocaleString("es-AR")} ítems`;
}
