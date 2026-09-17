"use client";

import { useState, type KeyboardEvent } from "react";
import type { BillingInvoiceType } from "@/generated/prisma/client";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import type { BillingRubroListItem } from "@/features/billing/types/billing-rubro.types";
import {
  centsToPesos,
  computeLineNetCents,
  extractNetCents,
  pesosToCents,
} from "@/shared/utils/billing-invoice-totals";
import {
  MAX_INVOICE_ITEM_QUANTITY,
  MAX_INVOICE_ITEM_UNIT_PRICE,
} from "@/shared/utils/billing-invoice-rules";
import { Plus, Tags, Trash2, ICON_STROKE } from "@/shared/icons";
import {
  invoiceItemDescriptionId,
  invoiceItemPriceId,
  invoiceItemQuantityId,
  invoiceItemRubroId,
  isInvoiceItemDeleteKey,
} from "@/features/billing/utils/invoice-keyboard-flow";
import { InvoiceSearchPicker } from "./InvoiceSearchPicker";
import styles from "@/features/billing/styles/NewInvoice.module.scss";

const MAX_VISIBLE_OPTIONS = 50;

export type InvoiceItemRow = {
  key: string;
  rubroId: string | null;
  rubroCode: string;
  rubroName: string;
  rubroQuery: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRowQuantity(row: InvoiceItemRow): number | null {
  const quantity = parseDecimalInput(row.quantity);
  return quantity !== null &&
    quantity > 0 &&
    quantity <= MAX_INVOICE_ITEM_QUANTITY
    ? quantity
    : null;
}

export function parseRowUnitPrice(row: InvoiceItemRow): number | null {
  const unitPrice = parseDecimalInput(row.unitPrice);
  return unitPrice !== null &&
    unitPrice > 0 &&
    unitPrice <= MAX_INVOICE_ITEM_UNIT_PRICE
    ? unitPrice
    : null;
}

export function isCompleteRow(row: InvoiceItemRow): boolean {
  return (
    row.rubroId !== null &&
    parseRowQuantity(row) !== null &&
    parseRowUnitPrice(row) !== null
  );
}

export function isEmptyDraftRow(row: InvoiceItemRow): boolean {
  return (
    row.rubroId === null &&
    row.rubroQuery.trim() === "" &&
    row.description.trim() === "" &&
    row.quantity.trim() === "1" &&
    row.unitPrice.trim() === ""
  );
}

export function isPartialDraftRow(row: InvoiceItemRow): boolean {
  return !isEmptyDraftRow(row) && !isCompleteRow(row);
}

export function withoutTrailingEmptyDraftRows(
  rows: InvoiceItemRow[],
): InvoiceItemRow[] {
  if (rows.length <= 1) {
    return rows;
  }

  let end = rows.length;
  while (end > 1 && isEmptyDraftRow(rows[end - 1]!)) {
    end -= 1;
  }

  return end === rows.length ? rows : rows.slice(0, end);
}

export function itemRowPatchForRubroQuery(
  value: string,
  hadSelectedRubro: boolean,
): Partial<InvoiceItemRow> {
  if (value.trim() === "") {
    return {
      rubroId: null,
      rubroCode: "",
      rubroName: "",
      rubroQuery: "",
      description: "",
      quantity: "1",
      unitPrice: "",
    };
  }

  return {
    rubroQuery: value,
    ...(hadSelectedRubro
      ? { rubroId: null, rubroCode: "", rubroName: "" }
      : {}),
  };
}

function formatMoneyFromCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centsToPesos(cents));
}

function formatLineTotal(
  row: InvoiceItemRow,
  ivaPercent: number,
): string | null {
  const quantity = parseRowQuantity(row);
  const unitPrice = parseRowUnitPrice(row);

  if (quantity === null || unitPrice === null) {
    return null;
  }

  const cents = computeLineNetCents(
    quantity,
    pesosToCents(unitPrice),
    ivaPercent,
  );
  return formatMoneyFromCents(cents);
}

function formatUnitNet(
  row: InvoiceItemRow,
  ivaPercent: number,
): string | null {
  const unitPrice = parseRowUnitPrice(row);
  if (unitPrice === null) {
    return null;
  }

  return formatMoneyFromCents(
    extractNetCents(pesosToCents(unitPrice), ivaPercent),
  );
}

function quantityLimitError(value: string): string | null {
  const quantity = parseDecimalInput(value);
  if (quantity === null || quantity <= 0) {
    return null;
  }

  if (quantity > MAX_INVOICE_ITEM_QUANTITY) {
    return `Máximo ${MAX_INVOICE_ITEM_QUANTITY}.`;
  }

  return null;
}

function unitPriceLimitError(value: string): string | null {
  const unitPrice = parseDecimalInput(value);
  if (unitPrice === null || unitPrice <= 0) {
    return null;
  }

  if (unitPrice > MAX_INVOICE_ITEM_UNIT_PRICE) {
    return `Máximo ${MAX_INVOICE_ITEM_UNIT_PRICE.toLocaleString("es-AR")}.`;
  }

  return null;
}

type InvoiceItemsSectionProps = {
  rows: InvoiceItemRow[];
  rubros: BillingRubroListItem[];
  ivaPercent: number;
  invoiceType: BillingInvoiceType | null;
  disabled: boolean;
  onRowChange: (key: string, patch: Partial<InvoiceItemRow>) => void;
  onRowSelectRubro: (key: string, rubro: BillingRubroListItem) => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onDescriptionKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    rowKey: string,
  ) => void;
  onQuantityKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    rowKey: string,
  ) => void;
  onPriceKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    rowKey: string,
  ) => void;
  onLeaveItemsSection: () => void;
};

export function InvoiceItemsSection({
  rows,
  rubros,
  ivaPercent,
  invoiceType,
  disabled,
  onRowChange,
  onRowSelectRubro,
  onAddRow,
  onRemoveRow,
  onDescriptionKeyDown,
  onQuantityKeyDown,
  onPriceKeyDown,
  onLeaveItemsSection,
}: InvoiceItemsSectionProps) {
  const [removeTarget, setRemoveTarget] = useState<InvoiceItemRow | null>(null);
  const canRemoveRows = rows.length > 1 && !disabled;
  const isTypeA = invoiceType === "A";

  function requestRemoveRow(row: InvoiceItemRow) {
    if (!canRemoveRows) {
      return;
    }
    setRemoveTarget(row);
  }

  function handleRowFieldKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    row: InvoiceItemRow,
    next?: (
      event: KeyboardEvent<HTMLInputElement>,
      rowKey: string,
    ) => void,
  ) {
    if (isInvoiceItemDeleteKey(event) && canRemoveRows) {
      event.preventDefault();
      requestRemoveRow(row);
      return;
    }

    next?.(event, row.key);
  }

  function optionsForQuery(query: string) {
    const normalized = query.trim().toLocaleLowerCase("es-AR");

    return rubros
      .filter((rubro) => {
        if (!normalized) {
          return true;
        }

        return (
          rubro.name.toLocaleLowerCase("es-AR").includes(normalized) ||
          rubro.code.toLocaleLowerCase("es-AR").includes(normalized)
        );
      })
      .slice(0, MAX_VISIBLE_OPTIONS)
      .map((rubro) => ({
        id: rubro.id,
        title: rubro.name,
        subtitle: rubro.description ?? undefined,
        badge: rubro.code,
      }));
  }

  return (
    <section className={styles.sectionCard} aria-label="Rubros de la factura">
      <h2 className={styles.sectionCardTitle}>
        <Tags className={styles.sectionCardIcon} strokeWidth={ICON_STROKE} aria-hidden />
        Rubros
      </h2>

      <div className={styles.itemsTableWrap}>
        <div
          className={`${styles.itemsHeader} ${isTypeA ? styles.itemsHeaderA : ""}`}
          aria-hidden
        >
          <span>Rubro</span>
          <span>Detalle</span>
          <span>Cant.</span>
          <span>P. unit. c/IVA</span>
          {isTypeA ? <span>P. unitario S/IVA</span> : null}
          <span>TOTAL S/IVA</span>
          <span />
        </div>

        <div className={styles.itemsList}>
          {rows.map((row, index) => {
            const lineTotal = formatLineTotal(row, ivaPercent);
            const unitNet = isTypeA ? formatUnitNet(row, ivaPercent) : null;
            const quantityError = quantityLimitError(row.quantity);
            const unitPriceError = unitPriceLimitError(row.unitPrice);

            return (
              <div
                key={row.key}
                className={`${styles.itemRow} ${isTypeA ? styles.itemRowA : ""}`}
                data-invoice-focus-row
              >
                <div className={styles.itemRubroCell}>
                  <label className={styles.srOnly} htmlFor={invoiceItemRubroId(row.key)}>
                    Rubro ítem {index + 1}
                  </label>
                  <InvoiceSearchPicker
                    inputId={invoiceItemRubroId(row.key)}
                    placeholder="Buscar rubro…"
                    query={row.rubroQuery}
                    options={optionsForQuery(row.rubroQuery)}
                    emptyText="No se encontraron rubros activos."
                    disabled={disabled}
                    onQueryChange={(value) =>
                      onRowChange(
                        row.key,
                        itemRowPatchForRubroQuery(value, row.rubroId !== null),
                      )
                    }
                    onSelect={(id) => {
                      const rubro = rubros.find(
                        (candidate) => candidate.id === id,
                      );
                      if (rubro) {
                        onRowSelectRubro(row.key, rubro);
                      }
                    }}
                    onLeaveEmpty={
                      isEmptyDraftRow(row) && rows.some(isCompleteRow)
                        ? onLeaveItemsSection
                        : undefined
                    }
                    onDeleteKey={
                      canRemoveRows ? () => requestRemoveRow(row) : undefined
                    }
                  />
                </div>

                <div className={styles.itemDetailCell}>
                  <label
                    className={styles.srOnly}
                    htmlFor={invoiceItemDescriptionId(row.key)}
                  >
                    Detalle ítem {index + 1}
                  </label>
                  <input
                    id={invoiceItemDescriptionId(row.key)}
                    className={styles.formInput}
                    value={row.description}
                    onChange={(event) =>
                      onRowChange(row.key, { description: event.target.value })
                    }
                    onKeyDown={(event) =>
                      handleRowFieldKeyDown(event, row, onDescriptionKeyDown)
                    }
                    placeholder="Detalle de la factura…"
                    maxLength={500}
                    spellCheck={false}
                    disabled={disabled || row.rubroId === null}
                  />
                </div>

                <div className={styles.itemNumberCell}>
                  <label
                    className={styles.srOnly}
                    htmlFor={invoiceItemQuantityId(row.key)}
                  >
                    Cantidad ítem {index + 1}
                  </label>
                  <input
                    id={invoiceItemQuantityId(row.key)}
                    type="text"
                    inputMode="decimal"
                    className={`${styles.formInput} ${
                      quantityError ? styles.formInputError : ""
                    }`}
                    value={row.quantity}
                    onChange={(event) =>
                      onRowChange(row.key, { quantity: event.target.value })
                    }
                    onKeyDown={(event) =>
                      handleRowFieldKeyDown(event, row, onQuantityKeyDown)
                    }
                    placeholder="1"
                    spellCheck={false}
                    disabled={disabled || row.rubroId === null}
                    aria-invalid={Boolean(quantityError)}
                  />
                  {quantityError ? (
                    <span className={styles.itemFieldError}>{quantityError}</span>
                  ) : null}
                </div>

                <div className={styles.itemNumberCell}>
                  <label
                    className={styles.srOnly}
                    htmlFor={invoiceItemPriceId(row.key)}
                  >
                    Precio unitario con IVA ítem {index + 1}
                  </label>
                  <input
                    id={invoiceItemPriceId(row.key)}
                    type="text"
                    inputMode="decimal"
                    className={`${styles.formInput} ${
                      unitPriceError ? styles.formInputError : ""
                    }`}
                    value={row.unitPrice}
                    onChange={(event) =>
                      onRowChange(row.key, { unitPrice: event.target.value })
                    }
                    onKeyDown={(event) =>
                      handleRowFieldKeyDown(event, row, onPriceKeyDown)
                    }
                    placeholder="0,00"
                    spellCheck={false}
                    disabled={disabled || row.rubroId === null}
                    aria-invalid={Boolean(unitPriceError)}
                  />
                  {unitPriceError ? (
                    <span className={styles.itemFieldError}>{unitPriceError}</span>
                  ) : null}
                </div>

                {isTypeA ? (
                  <div className={styles.itemLineTotal}>
                    <span
                      className={`${styles.itemLineTotalValue} ${
                        unitNet ? "" : styles.itemLineTotalEmpty
                      }`}
                    >
                      {unitNet ?? "—"}
                    </span>
                  </div>
                ) : null}

                <div className={styles.itemLineTotal}>
                  <span
                    className={`${styles.itemLineTotalValue} ${
                      lineTotal ? "" : styles.itemLineTotalEmpty
                    }`}
                  >
                    {lineTotal ?? "—"}
                  </span>
                </div>

                <div className={styles.itemRemoveCell}>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className={styles.itemRemoveButton}
                      onClick={() => requestRemoveRow(row)}
                      disabled={disabled}
                      aria-label={`Quitar ítem ${index + 1}`}
                    >
                      <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className={styles.fieldHint}>
        Puede editar el detalle solo para esta factura; el rubro original no
        se modifica. En un rubro vacío, Esc pasa al método de pago. Supr quita
        el ítem. La tecla + agrega un ítem cuando no está escribiendo en un
        campo.
      </p>

      <button
        type="button"
        className={styles.addItemButton}
        onClick={onAddRow}
        disabled={disabled}
      >
        <Plus strokeWidth={ICON_STROKE} aria-hidden />
        Agregar ítem
      </button>

      {removeTarget ? (
        <ConfirmDialog
          title="Quitar ítem"
          message={
            removeTarget.rubroName
              ? `¿Quitar ${removeTarget.rubroName} de esta factura?`
              : "¿Quitar este ítem de la factura?"
          }
          confirmLabel="Quitar"
          variant="danger"
          confirmShortcutKey="Delete"
          equalWidthActions
          onConfirm={() => {
            onRemoveRow(removeTarget.key);
            setRemoveTarget(null);
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      ) : null}
    </section>
  );
}
