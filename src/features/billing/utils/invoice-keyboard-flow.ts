import type { BillingPaymentMethod } from "@/generated/prisma/client";

export const INVOICE_CLIENT_PICKER_ID = "invoice-client-picker";
export const INVOICE_PAYMENT_METHOD_ID = "invoice-payment-method";
export const INVOICE_NOTES_ID = "invoice-notes";
export const INVOICE_DISCOUNT_ID = "invoice-discount";
export const INVOICE_SUBMIT_ID = "invoice-submit";
export const PAYMENT_METHOD_GRID_COLUMNS = 2;

export type InvoiceItemKeyboardField =
  | "rubro"
  | "description"
  | "quantity"
  | "price";

export type PickerHighlightItem =
  | { type: "leading" }
  | { type: "secondary" }
  | { type: "option"; id: string };

export type PickerLeadingHighlight = "leading" | "secondary";

export type PickerArrowKey =
  | "ArrowDown"
  | "ArrowUp"
  | "ArrowLeft"
  | "ArrowRight";

export type InvoiceKeyboardRowSnapshot = {
  key: string;
  hasRubro: boolean;
  quantityValid: boolean;
  priceValid: boolean;
  isEmptyDraft: boolean;
};

export type PriceEnterResult =
  | { type: "focus"; field: InvoiceItemKeyboardField; rowKey: string }
  | { type: "focus-empty-rubro"; rowKey: string }
  | { type: "add-empty-row" };

export function invoiceItemRubroId(rowKey: string): string {
  return `item-rubro-${rowKey}`;
}

export function invoiceItemDescriptionId(rowKey: string): string {
  return `item-description-${rowKey}`;
}

export function invoiceItemQuantityId(rowKey: string): string {
  return `item-quantity-${rowKey}`;
}

export function invoiceItemPriceId(rowKey: string): string {
  return `item-price-${rowKey}`;
}

export function invoiceItemFieldId(
  field: InvoiceItemKeyboardField,
  rowKey: string,
): string {
  switch (field) {
    case "rubro":
      return invoiceItemRubroId(rowKey);
    case "description":
      return invoiceItemDescriptionId(rowKey);
    case "quantity":
      return invoiceItemQuantityId(rowKey);
    case "price":
      return invoiceItemPriceId(rowKey);
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

export function invoicePaymentMethodButtonId(method: BillingPaymentMethod): string {
  return `invoice-payment-${method}`;
}

export type PaymentMethodCell = {
  method: BillingPaymentMethod;
  row: number;
  col: number;
  span: number;
};

export function buildPaymentMethodCells(
  methods: readonly BillingPaymentMethod[],
  allowOnAccount: boolean,
): PaymentMethodCell[] {
  const cells: PaymentMethodCell[] = [];
  let row = 0;
  let col = 0;

  for (const method of methods) {
    if (method === "CUENTA_CORRIENTE" && !allowOnAccount) {
      continue;
    }

    const span =
      method === "CUENTA_CORRIENTE" ? PAYMENT_METHOD_GRID_COLUMNS : 1;
    if (span > 1 && col !== 0) {
      row += 1;
      col = 0;
    }

    cells.push({ method, row, col, span });
    col += span;
    if (col >= PAYMENT_METHOD_GRID_COLUMNS) {
      col = 0;
      row += 1;
    }
  }

  return cells;
}

function cellAt(
  cells: readonly PaymentMethodCell[],
  row: number,
  col: number,
): PaymentMethodCell | undefined {
  return cells.find(
    (cell) =>
      cell.row === row && col >= cell.col && col < cell.col + cell.span,
  );
}

function rowWidth(
  cells: readonly PaymentMethodCell[],
  row: number,
): number {
  let width = 0;
  for (const cell of cells) {
    if (cell.row === row) {
      width = Math.max(width, cell.col + cell.span);
    }
  }
  return Math.max(width, 1);
}

function lastRowIndex(cells: readonly PaymentMethodCell[]): number {
  return cells.reduce((max, cell) => Math.max(max, cell.row), 0);
}

export function resolvePaymentMethodMove(
  methods: readonly BillingPaymentMethod[],
  current: BillingPaymentMethod,
  key: PickerArrowKey,
  allowOnAccount: boolean,
  preferredColumn: number,
): { method: BillingPaymentMethod; preferredColumn: number } {
  const cells = buildPaymentMethodCells(methods, allowOnAccount);
  const currentCell = cells.find((cell) => cell.method === current) ?? cells[0];

  if (!currentCell) {
    return { method: current, preferredColumn };
  }

  const column = Math.min(
    Math.max(0, currentCell.span > 1 ? preferredColumn : currentCell.col),
    PAYMENT_METHOD_GRID_COLUMNS - 1,
  );

  function moveTo(cell: PaymentMethodCell): {
    method: BillingPaymentMethod;
    preferredColumn: number;
  } {
    return {
      method: cell.method,
      preferredColumn: cell.span > 1 ? column : cell.col,
    };
  }

  const bottomRow = lastRowIndex(cells);

  switch (key) {
    case "ArrowRight": {
      const width = rowWidth(cells, currentCell.row);
      const nextCol = (currentCell.col + currentCell.span) % width;
      return moveTo(cellAt(cells, currentCell.row, nextCol) ?? currentCell);
    }
    case "ArrowLeft": {
      const width = rowWidth(cells, currentCell.row);
      const nextCol = (currentCell.col - 1 + width) % width;
      return moveTo(cellAt(cells, currentCell.row, nextCol) ?? currentCell);
    }
    case "ArrowDown": {
      const nextRow = currentCell.row === bottomRow ? 0 : currentCell.row + 1;
      return moveTo(cellAt(cells, nextRow, column) ?? currentCell);
    }
    case "ArrowUp": {
      const nextRow = currentCell.row === 0 ? bottomRow : currentCell.row - 1;
      return moveTo(cellAt(cells, nextRow, column) ?? currentCell);
    }
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

export function buildPickerHighlightItems(
  hasLeading: boolean,
  hasSecondary: boolean,
  optionIds: readonly string[],
): PickerHighlightItem[] {
  const items: PickerHighlightItem[] = [];

  if (hasLeading) {
    items.push({ type: "leading" });
  }
  if (hasSecondary) {
    items.push({ type: "secondary" });
  }
  for (const id of optionIds) {
    items.push({ type: "option", id });
  }

  return items;
}

export function initialPickerHighlightIndex(
  items: readonly PickerHighlightItem[],
): number {
  const firstOptionIndex = items.findIndex((item) => item.type === "option");
  return firstOptionIndex >= 0 ? firstOptionIndex : 0;
}

function lastOptionIndex(items: readonly PickerHighlightItem[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.type === "option") {
      return index;
    }
  }
  return -1;
}

export function resolvePickerHighlightMove(
  items: readonly PickerHighlightItem[],
  currentIndex: number,
  key: PickerArrowKey,
  preferredLeading: PickerLeadingHighlight = "leading",
): number {
  if (items.length === 0) {
    return currentIndex;
  }

  const current = items[currentIndex];
  if (!current) {
    return 0;
  }

  const leadingIndex = items.findIndex((item) => item.type === "leading");
  const secondaryIndex = items.findIndex((item) => item.type === "secondary");
  const firstOption = items.findIndex((item) => item.type === "option");
  const lastOption = lastOptionIndex(items);
  const hasSplitLeading = leadingIndex >= 0 && secondaryIndex >= 0;

  switch (key) {
    case "ArrowRight": {
      if (hasSplitLeading && current.type === "leading") {
        return secondaryIndex;
      }
      return currentIndex;
    }
    case "ArrowLeft": {
      if (hasSplitLeading && current.type === "secondary") {
        return leadingIndex;
      }
      return currentIndex;
    }
    case "ArrowDown": {
      if (
        hasSplitLeading &&
        (current.type === "leading" || current.type === "secondary")
      ) {
        return firstOption >= 0 ? firstOption : currentIndex;
      }
      const next = currentIndex + 1;
      return next >= items.length ? 0 : next;
    }
    case "ArrowUp": {
      if (
        hasSplitLeading &&
        current.type === "option" &&
        currentIndex === firstOption
      ) {
        return preferredLeading === "secondary" ? secondaryIndex : leadingIndex;
      }
      if (
        hasSplitLeading &&
        (current.type === "leading" || current.type === "secondary")
      ) {
        return lastOption >= 0 ? lastOption : currentIndex;
      }
      const next = currentIndex - 1;
      return next < 0 ? items.length - 1 : next;
    }
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

export type OverflowBox = {
  scrollTop: number;
  top: number;
  bottom: number;
};

export type OverflowItemBox = {
  top: number;
  bottom: number;
};

export function nextOverflowScrollTop(
  container: OverflowBox,
  item: OverflowItemBox,
): number {
  if (item.bottom > container.bottom) {
    return container.scrollTop + (item.bottom - container.bottom);
  }

  if (item.top < container.top) {
    return Math.max(0, container.scrollTop - (container.top - item.top));
  }

  return container.scrollTop;
}

export function scrollOverflowItemIntoView(
  container: HTMLElement,
  item: HTMLElement,
): void {
  const containerRect = container.getBoundingClientRect();
  container.scrollTop = nextOverflowScrollTop(
    {
      scrollTop: container.scrollTop,
      top: containerRect.top,
      bottom: containerRect.bottom,
    },
    item.getBoundingClientRect(),
  );
}

export function findScrollableAncestor(
  element: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const canScrollY =
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      current.scrollHeight > current.clientHeight + 1;

    if (canScrollY) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function invoiceFocusScrollTarget(element: HTMLElement): HTMLElement {
  const row = element.closest("[data-invoice-focus-row]");
  if (row instanceof HTMLElement) {
    return row;
  }

  return element.closest("section") ?? element;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function scrollInvoiceFocusIntoView(element: HTMLElement): void {
  const target = invoiceFocusScrollTarget(element);
  const container = findScrollableAncestor(target);

  if (!container) {
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
    return;
  }

  const padding = 16;
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextTop = nextOverflowScrollTop(
    {
      scrollTop: container.scrollTop,
      top: containerRect.top + padding,
      bottom: containerRect.bottom - padding,
    },
    targetRect,
  );

  if (nextTop === container.scrollTop) {
    return;
  }

  if (prefersReducedMotion() || typeof container.scrollTo !== "function") {
    container.scrollTop = nextTop;
    return;
  }

  container.scrollTo({ top: nextTop, behavior: "smooth" });
}

export function shouldLeaveEmptyPicker(query: string): boolean {
  return query.trim() === "";
}

export function isInvoiceFlowEnter(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}): boolean {
  if (event.key !== "Enter") {
    return false;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  if (event.isComposing) {
    return false;
  }

  return true;
}

export function isInvoiceItemDeleteKey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
}): boolean {
  if (event.repeat || event.isComposing) {
    return false;
  }

  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  ) {
    return false;
  }

  return event.key === "Delete";
}

export type DiscountEnterResult = "stay" | "skip" | "apply";

export function resolveDiscountEnter(
  input: string,
  canApply: boolean,
): DiscountEnterResult {
  if (input.trim() === "") {
    return "skip";
  }

  if (canApply) {
    return "apply";
  }

  return "stay";
}

export function isInvoiceAddItemShortcut(event: {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
}): boolean {
  if (event.repeat || event.isComposing) {
    return false;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  return event.key === "+" || event.code === "NumpadAdd";
}

export type AddItemShortcutResult =
  | { type: "focus-empty-rubro"; rowKey: string }
  | { type: "add-empty-row" };

export function resolveAddItemShortcut(
  rows: readonly InvoiceKeyboardRowSnapshot[],
): AddItemShortcutResult {
  const emptyRow = rows.find((candidate) => candidate.isEmptyDraft);
  if (emptyRow) {
    return { type: "focus-empty-rubro", rowKey: emptyRow.key };
  }

  return { type: "add-empty-row" };
}

export function firstIncompleteItemField(
  row: InvoiceKeyboardRowSnapshot,
): InvoiceItemKeyboardField | null {
  if (!row.hasRubro) {
    return "rubro";
  }
  if (!row.quantityValid) {
    return "quantity";
  }
  if (!row.priceValid) {
    return "price";
  }
  return null;
}

export function resolveQuantityEnter(
  quantityValid: boolean,
): "stay" | "price" {
  return quantityValid ? "price" : "stay";
}

export function resolvePriceEnter(
  rowKey: string,
  rows: readonly InvoiceKeyboardRowSnapshot[],
): PriceEnterResult {
  const row = rows.find((candidate) => candidate.key === rowKey);

  if (!row) {
    return { type: "focus", field: "price", rowKey };
  }

  const incomplete = firstIncompleteItemField(row);
  if (incomplete) {
    return { type: "focus", field: incomplete, rowKey };
  }

  const emptyRow = rows.find(
    (candidate) => candidate.isEmptyDraft && candidate.key !== rowKey,
  );
  if (emptyRow) {
    return { type: "focus-empty-rubro", rowKey: emptyRow.key };
  }

  return { type: "add-empty-row" };
}

export function focusInvoiceField(id: string): void {
  if (typeof document === "undefined") {
    return;
  }

  function attempt(): boolean {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement) || element.hasAttribute("disabled")) {
      return false;
    }

    element.focus({ preventScroll: true });
    if (document.activeElement === element) {
      scrollInvoiceFocusIntoView(element);
      return true;
    }

    return false;
  }

  if (attempt()) {
    return;
  }

  requestAnimationFrame(() => {
    if (attempt()) {
      return;
    }
    requestAnimationFrame(() => {
      attempt();
    });
  });
}

export function focusInvoicePaymentMethod(): void {
  if (typeof document === "undefined") {
    return;
  }

  const group = document.getElementById(INVOICE_PAYMENT_METHOD_ID);
  if (!group) {
    return;
  }

  if (group.getAttribute("role") === "radiogroup") {
    const selected = group.querySelector<HTMLElement>(
      '[role="radio"][aria-checked="true"]:not(:disabled)',
    );
    const fallback = group.querySelector<HTMLElement>(
      '[role="radio"]:not(:disabled)',
    );
    const target = selected ?? fallback;
    if (target) {
      target.focus({ preventScroll: true });
      scrollInvoiceFocusIntoView(target);
      return;
    }
  }

  if (group instanceof HTMLElement && !group.hasAttribute("disabled")) {
    group.focus({ preventScroll: true });
    scrollInvoiceFocusIntoView(group);
  }
}
