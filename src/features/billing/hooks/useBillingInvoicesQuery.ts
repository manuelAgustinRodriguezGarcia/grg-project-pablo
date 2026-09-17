import { useQuery } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";

export async function fetchBillingInvoicesList(): Promise<
  BillingInvoiceListItem[]
> {
  const result = await listBillingInvoicesAction();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

export function useBillingInvoicesQuery(
  initialInvoices: BillingInvoiceListItem[] = [],
) {
  return useQuery({
    queryKey: adminQueryKeys.billingInvoices(),
    queryFn: fetchBillingInvoicesList,
    initialData: initialInvoices,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  });
}
