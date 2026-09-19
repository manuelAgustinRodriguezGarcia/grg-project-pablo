"use client";

import { useCallback, useEffect } from "react";
import type { KeyboardEvent } from "react";
import {
  isEmptyDraftRow,
  parseRowQuantity,
  parseRowUnitPrice,
  type InvoiceItemRow,
} from "@/features/billing/components/invoices/InvoiceItemsSection";
import { isTypingTarget } from "@/features/billing/hooks/useBillingModalKeyboard";
import {
  INVOICE_CLIENT_PICKER_ID,
  focusInvoiceField,
  focusInvoicePaymentMethod,
  invoiceItemDescriptionId,
  invoiceItemFieldId,
  invoiceItemQuantityId,
  invoiceItemRubroId,
  isInvoiceAddItemShortcut,
  isInvoiceFlowEnter,
  resolveAddItemShortcut,
  resolvePriceEnter,
  resolveQuantityEnter,
  type InvoiceKeyboardRowSnapshot,
} from "@/features/billing/utils/invoice-keyboard-flow";

type UseInvoiceKeyboardFlowOptions = {
  rows: InvoiceItemRow[];
  addEmptyRow: () => string;
  discardTrailingEmptyRows: () => void;
  commitQuantity?: (rowKey: string, quantity: string) => void;
  focusClientPickerWhen: boolean;
  enabled?: boolean;
};

function toKeyboardSnapshot(row: InvoiceItemRow): InvoiceKeyboardRowSnapshot {
  return {
    key: row.key,
    hasRubro: row.rubroId !== null,
    quantityValid: parseRowQuantity(row) !== null,
    priceValid: parseRowUnitPrice(row) !== null,
    isEmptyDraft: isEmptyDraftRow(row),
  };
}

export function useInvoiceKeyboardFlow({
  rows,
  addEmptyRow,
  discardTrailingEmptyRows,
  commitQuantity,
  focusClientPickerWhen,
  enabled = true,
}: UseInvoiceKeyboardFlowOptions) {
  const focusClientPicker = useCallback(() => {
    focusInvoiceField(INVOICE_CLIENT_PICKER_ID);
  }, []);

  const isFirstItemRow = useCallback(
    (rowKey: string) => rows[0]?.key === rowKey,
    [rows],
  );

  const focusItemField = useCallback(
    (id: string, rowKey: string, forceScroll = false) => {
      focusInvoiceField(id, {
        scroll: forceScroll || !isFirstItemRow(rowKey),
      });
    },
    [isFirstItemRow],
  );

  useEffect(() => {
    if (!focusClientPickerWhen) {
      return;
    }

    focusClientPicker();
  }, [focusClientPicker, focusClientPickerWhen]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleAddItemShortcut(event: globalThis.KeyboardEvent) {
      if (!isInvoiceAddItemShortcut(event) || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      const result = resolveAddItemShortcut(rows.map(toKeyboardSnapshot));
      switch (result.type) {
        case "focus-empty-rubro":
          focusItemField(invoiceItemRubroId(result.rowKey), result.rowKey, true);
          return;
        case "add-empty-row": {
          const nextKey = addEmptyRow();
          focusItemField(invoiceItemRubroId(nextKey), nextKey, true);
          return;
        }
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    }

    document.addEventListener("keydown", handleAddItemShortcut);
    return () => {
      document.removeEventListener("keydown", handleAddItemShortcut);
    };
  }, [addEmptyRow, enabled, focusItemField, rows]);

  const focusFirstRubro = useCallback(() => {
    const firstRow = rows[0];
    if (!firstRow) {
      return;
    }
    focusInvoiceField(invoiceItemRubroId(firstRow.key), { scroll: false });
  }, [rows]);

  const leaveItemsSection = useCallback(() => {
    discardTrailingEmptyRows();
    focusInvoicePaymentMethod();
    requestAnimationFrame(() => {
      focusInvoicePaymentMethod();
    });
  }, [discardTrailingEmptyRows]);

  const afterRubroSelected = useCallback(
    (rowKey: string) => {
      focusItemField(invoiceItemDescriptionId(rowKey), rowKey);
    },
    [focusItemField],
  );

  const handleDescriptionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, rowKey: string) => {
      if (!isInvoiceFlowEnter(event)) {
        return;
      }

      event.preventDefault();
      focusItemField(invoiceItemQuantityId(rowKey), rowKey);
    },
    [focusItemField],
  );

  const handleQuantityKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, rowKey: string) => {
      if (!isInvoiceFlowEnter(event)) {
        return;
      }

      event.preventDefault();

      const row = rows.find((candidate) => candidate.key === rowKey);
      const quantityValid = row ? parseRowQuantity(row) !== null : false;
      const result = resolveQuantityEnter({
        quantityRaw: row?.quantity ?? "",
        quantityValid,
      });

      if (result === "stay") {
        return;
      }

      if (result === "commit-default") {
        commitQuantity?.(rowKey, "1");
      }

      focusItemField(invoiceItemFieldId("price", rowKey), rowKey);
    },
    [commitQuantity, focusItemField, rows],
  );

  const handlePriceKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, rowKey: string) => {
      if (!isInvoiceFlowEnter(event)) {
        return;
      }

      event.preventDefault();

      const finishedFirstItem = isFirstItemRow(rowKey);
      const result = resolvePriceEnter(rowKey, rows.map(toKeyboardSnapshot));
      switch (result.type) {
        case "focus":
          focusItemField(
            invoiceItemFieldId(result.field, result.rowKey),
            result.rowKey,
          );
          return;
        case "focus-empty-rubro":
          focusItemField(
            invoiceItemRubroId(result.rowKey),
            result.rowKey,
            finishedFirstItem,
          );
          return;
        case "add-empty-row": {
          const nextKey = addEmptyRow();
          focusItemField(
            invoiceItemRubroId(nextKey),
            nextKey,
            finishedFirstItem,
          );
          return;
        }
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    },
    [addEmptyRow, focusItemField, isFirstItemRow, rows],
  );

  return {
    focusClientPicker,
    focusFirstRubro,
    leaveItemsSection,
    afterRubroSelected,
    handleDescriptionKeyDown,
    handleQuantityKeyDown,
    handlePriceKeyDown,
  };
}
