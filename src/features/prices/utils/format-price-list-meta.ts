export function formatPriceListUpdatedAt(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatPriceListMeta(
  itemCount: number,
  updatedAt: string,
): string {
  const countLabel =
    itemCount === 1 ? "1 ítem" : `${itemCount.toLocaleString("es-AR")} ítems`;
  const dateLabel = formatPriceListUpdatedAt(updatedAt);
  return dateLabel ? `${countLabel} · Actualizado ${dateLabel}` : countLabel;
}
