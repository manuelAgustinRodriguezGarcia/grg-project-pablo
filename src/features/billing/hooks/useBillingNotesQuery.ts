import { useQuery } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { listBillingNotesAction } from "@/features/billing/actions/billing-note.actions";
import type { BillingNoteListItem } from "@/features/billing/types/billing-note.types";

export function useBillingNotesQuery(
  initialNotes: BillingNoteListItem[] = [],
) {
  return useQuery({
    queryKey: adminQueryKeys.billingNotes(),
    queryFn: async (): Promise<BillingNoteListItem[]> => {
      const result = await listBillingNotesAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    ...(initialNotes.length > 0 ? { initialData: initialNotes } : {}),
    staleTime: 30_000,
  });
}
