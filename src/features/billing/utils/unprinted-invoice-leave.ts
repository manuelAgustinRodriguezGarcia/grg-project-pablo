import {
  BILLING_DEBTORS_PATH,
  BILLING_HUB_PATH,
  BILLING_INVOICES_PATH,
  BILLING_SECTIONS,
} from "@/features/billing/data/billingNav";
import type { UnprintedLeaveAction } from "@/features/billing/components/invoices/UnprintedInvoiceLeaveDialog";

export type UnprintedLeaveIntent =
  | { type: "reset" }
  | { type: "navigate"; href: string; exact?: boolean };

function normalizeBillingPath(href: string): string {
  const withoutQuery = href.split("?")[0] ?? href;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

const SECTION_LEAVE_LABELS: Record<string, string> = {
  "Clientes con deuda": "Deudores",
};

export function resolveUnprintedLeaveAction(
  intent: UnprintedLeaveIntent,
): UnprintedLeaveAction {
  if (intent.type === "reset") {
    return { label: "Crear nueva", shortcut: "N" };
  }

  const path = normalizeBillingPath(intent.href);

  if (path === normalizeBillingPath(BILLING_INVOICES_PATH)) {
    return { label: "Ir a facturas", shortcut: "L" };
  }

  if (path === normalizeBillingPath(BILLING_DEBTORS_PATH)) {
    return { label: "Ir a Deudores" };
  }

  if (path === normalizeBillingPath(BILLING_HUB_PATH)) {
    return { label: "Ir al inicio" };
  }

  const section = BILLING_SECTIONS.find(
    (candidate) => normalizeBillingPath(candidate.href) === path,
  );
  if (section) {
    const shortLabel =
      SECTION_LEAVE_LABELS[section.label] ?? section.label;
    return { label: `Ir a ${shortLabel}` };
  }

  return { label: "Salir" };
}
