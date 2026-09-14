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
  focusClientPickerWhen,
  enabled = true,
}: UseInvoiceKeyboardFlowOptions) {
  const focusClientPicker = useCallback(() => {
    focusInvoiceField(INVOICE_CLIENT_PICKER_ID);
  }, []);

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
          focusInvoiceField(invoiceItemRubroId(result.rowKey));
          return;
        case "add-empty-row": {
          const nextKey = addEmptyRow();
          focusInvoiceField(invoiceItemRubroId(nextKey));
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
  }, [addEmptyRow, enabled, rows]);

  const focusFirstRubro = useCallback(() => {
    const firstRow = rows[0];
    if (!firstRow) {
      return;
    }
    focusInvoiceField(invoiceItemRubroId(firstRow.key));
  }, [rows]);

  const leaveItemsSection = useCallback(() => {
    discardTrailingEmptyRows();
    focusInvoicePaymentMethod();
    requestAnimationFrame(() => {
      focusInvoicePaymentMethod();
    });
  }, [discardTrailingEmptyRows]);

  const afterRubroSelected = useCallback((rowKey: string) => {
    focusInvoiceField(invoiceItemDescriptionId(rowKey));
  }, []);

  const handleDescriptionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, rowKey: string) => {
      if (!isInvoiceFlowEnter(event)) {
        return;
      }

      event.preventDefault();
      focusInvoiceField(invoiceItemQuantityId(rowKey));
    },
    [],
  );

  const handleQuantityKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, rowKey: string) => {
      if (!isInvoiceFlowEnter(event)) {
        return;
      }

      event.preventDefault();

      const row = rows.find((candidate) => candidate.key === rowKey);
      const quantityValid = row ? parseRowQuantity(row) !== null : false;
      if (resolveQuantityEnter(quantityValid) === "stay") {
        return;
      }

      focusInvoiceField(invoiceItemFieldId("price", rowKey));
    },
    [rows],
  );

  const handlePriceKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, rowKey: string) => {
      if (!isInvoiceFlowEnter(event)) {
        return;
      }

      event.preventDefault();

      const result = resolvePriceEnter(rowKey, rows.map(toKeyboardSnapshot));
      switch (result.type) {
        case "focus":
          focusInvoiceField(invoiceItemFieldId(result.field, result.rowKey));
          return;
        case "focus-empty-rubro":
          focusInvoiceField(invoiceItemRubroId(result.rowKey));
          return;
        case "add-empty-row": {
          const nextKey = addEmptyRow();
          focusInvoiceField(invoiceItemRubroId(nextKey));
          return;
        }
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    },
    [addEmptyRow, rows],
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
