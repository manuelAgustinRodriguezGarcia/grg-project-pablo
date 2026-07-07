import type { PriceListWithItemCount } from "@/server/repositories/price-list.repository";
import { dateToIsoDateOnly } from "@/shared/utils/date-only";

export type PriceListListItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  order: number;
  visibleToNormalUser: boolean;
  supplierName: string | null;
  supplierDate: string | null;
  itemCount: number;
  updatedAt: string;
};

export type PriceListActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export function toPriceListListItem(list: PriceListWithItemCount): PriceListListItem {
  return {
    id: list.id,
    name: list.name,
    description: list.description,
    status: list.status,
    order: list.order,
    visibleToNormalUser: list.visibleToNormalUser,
    supplierName: list.supplierName,
    supplierDate: list.supplierDate ? dateToIsoDateOnly(list.supplierDate) : null,
    itemCount: list.itemCount,
    updatedAt: list.updatedAt.toISOString(),
  };
}
