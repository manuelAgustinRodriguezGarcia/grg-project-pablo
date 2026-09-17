import { useQuery } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { listBillingClientsAction } from "@/features/billing/actions/billing-client.actions";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";

export function useBillingClientsQuery(
  initialClients?: BillingClientListItem[],
) {
  return useQuery({
    queryKey: adminQueryKeys.billingClients(),
    queryFn: async (): Promise<BillingClientListItem[]> => {
      const result = await listBillingClientsAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    ...(initialClients !== undefined ? { initialData: initialClients } : {}),
    staleTime: 30_000,
  });
}
