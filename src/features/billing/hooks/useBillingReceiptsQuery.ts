import { useQuery } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { listBillingReceiptsAction } from "@/features/billing/actions/billing-receipt.actions";
import type { BillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";

export function useBillingReceiptsQuery(
  initialReceipts: BillingReceiptListItem[] = [],
) {
  return useQuery({
    queryKey: adminQueryKeys.billingReceipts(),
    queryFn: async (): Promise<BillingReceiptListItem[]> => {
      const result = await listBillingReceiptsAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    ...(initialReceipts.length > 0 ? { initialData: initialReceipts } : {}),
    staleTime: 30_000,
  });
}
