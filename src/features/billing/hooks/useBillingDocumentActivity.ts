"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { markBillingDocumentActivityAction } from "@/features/billing/actions/billing-document-activity.actions";
import {
  applyDocumentActivity,
  type BillingDocumentActivity,
  type BillingDocumentActivityKind,
  type BillingDocumentKind,
} from "@/features/billing/types/billing-document-activity";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import type { BillingNoteListItem } from "@/features/billing/types/billing-note.types";
import type { BillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";

function patchById<T extends BillingDocumentActivity & { id: string }>(
  items: T[] | undefined,
  id: string,
  activity: BillingDocumentActivityKind,
  at: Date,
): T[] | undefined {
  if (!items) {
    return items;
  }

  return items.map((item) =>
    item.id === id ? applyDocumentActivity(item, activity, at) : item,
  );
}

export function useBillingDocumentActivity() {
  const queryClient = useQueryClient();

  return useCallback(
    async (
      documentKind: BillingDocumentKind,
      id: string,
      activity: BillingDocumentActivityKind,
    ): Promise<void> => {
      const result = await markBillingDocumentActivityAction({
        documentKind,
        id,
        activity,
      });
      if (!result.success) {
        return;
      }

      const at =
        activity === "printed"
          ? result.data.printedAt
          : activity === "downloaded"
            ? result.data.downloadedAt
            : result.data.sharedAt;
      if (!at) {
        return;
      }

      switch (documentKind) {
        case "INVOICE":
          queryClient.setQueryData<BillingInvoiceListItem[]>(
            adminQueryKeys.billingInvoices(),
            (current) => patchById(current, id, activity, at),
          );
          return;
        case "RECEIPT":
          queryClient.setQueryData<BillingReceiptListItem[]>(
            adminQueryKeys.billingReceipts(),
            (current) => patchById(current, id, activity, at),
          );
          return;
        case "NOTE":
          queryClient.setQueryData<BillingNoteListItem[]>(
            adminQueryKeys.billingNotes(),
            (current) => patchById(current, id, activity, at),
          );
          return;
        default: {
          const exhaustive: never = documentKind;
          return exhaustive;
        }
      }
    },
    [queryClient],
  );
}
