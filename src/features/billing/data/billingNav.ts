import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BookUser,
  Cog,
  FileText,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Tags,
  Wallet,
} from "@/shared/icons";

export type BillingSectionTone =
  | "sky"
  | "teal"
  | "indigo"
  | "amber"
  | "rose"
  | "slate";

export type BillingSectionConfig = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: BillingSectionTone;
};

export const BILLING_HUB_PATH = "/admin/facturacion";
export const BILLING_NEW_INVOICE_PATH = `${BILLING_HUB_PATH}/nueva-factura`;
export const BILLING_NEW_INVOICE_SHORTCUT = "F2";
export const BILLING_INVOICES_PATH = `${BILLING_HUB_PATH}/facturas`;
export const BILLING_CLIENTS_PATH = `${BILLING_HUB_PATH}/clientes`;
export const BILLING_DEBTORS_PATH = `${BILLING_HUB_PATH}/deudores`;
export const BILLING_MOVIMIENTOS_PATH = `${BILLING_HUB_PATH}/movimientos`;
export const BILLING_CLIENT_ID_QUERY = "cliente";
export const BILLING_CLIENT_HISTORY_QUERY = "historial";
export const BILLING_INVOICE_ID_QUERY = "factura";
export const BILLING_PAYMENT_STATUS_QUERY = "estado";

export function billingClientHistoryHref(clientId: string): string {
  const params = new URLSearchParams({
    [BILLING_CLIENT_ID_QUERY]: clientId,
    [BILLING_CLIENT_HISTORY_QUERY]: "1",
  });
  return `${BILLING_CLIENTS_PATH}?${params.toString()}`;
}

export function billingInvoiceDetailHref(invoiceId: string): string {
  const params = new URLSearchParams({
    [BILLING_INVOICE_ID_QUERY]: invoiceId,
  });
  return `${BILLING_INVOICES_PATH}?${params.toString()}`;
}

export const BILLING_SECTIONS: BillingSectionConfig[] = [
  {
    href: `${BILLING_HUB_PATH}/clientes`,
    label: "Clientes",
    description: "Alta, edición y consulta de clientes de facturación.",
    icon: BookUser,
    tone: "sky",
  },
  {
    href: BILLING_DEBTORS_PATH,
    label: "Clientes con deuda",
    description: "Listado de clientes con saldo pendiente de cuenta corriente.",
    icon: Wallet,
    tone: "rose",
  },
  {
    href: `${BILLING_HUB_PATH}/rubros`,
    label: "Rubros",
    description: "Conceptos y categorías usados en las facturas.",
    icon: Tags,
    tone: "teal",
  },
  {
    href: BILLING_NEW_INVOICE_PATH,
    label: "Nueva factura",
    description: "Crear comprobantes en modo prueba o fiscal.",
    icon: Plus,
    tone: "indigo",
  },
  {
    href: BILLING_INVOICES_PATH,
    label: "Facturas",
    description: "Historial, filtros, descarga de facturas y Libro IVA.",
    icon: ReceiptText,
    tone: "amber",
  },
  {
    href: BILLING_MOVIMIENTOS_PATH,
    label: "Movimientos",
    description: "Recibos, notas de crédito, notas de débito e imputaciones.",
    icon: ArrowLeftRight,
    tone: "rose",
  },
  {
    href: `${BILLING_HUB_PATH}/configuracion-fiscal`,
    label: "Configuración",
    description: "IVA, límite de cliente genérico y ambiente de emisión.",
    icon: Cog,
    tone: "slate",
  },
];

export type BillingNavIconTone = "blue" | "red";

export type BillingNavMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  iconTone: BillingNavIconTone;
};

export type BillingNavTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  menuItems?: BillingNavMenuItem[];
};

export function billingPathMatchesHref(
  path: string,
  href: string,
  exact = false,
): boolean {
  return exact ? path === href : path === href || path.startsWith(`${href}/`);
}

export function billingTabMatchesPath(
  path: string,
  tab: BillingNavTab,
): boolean {
  if (billingPathMatchesHref(path, tab.href, tab.exact)) {
    return true;
  }

  return Boolean(
    tab.menuItems?.some((item) => billingPathMatchesHref(path, item.href)),
  );
}

export function billingTabCurrentMenuItem(
  path: string,
  tab: BillingNavTab,
): BillingNavMenuItem | undefined {
  return tab.menuItems?.find((item) => billingPathMatchesHref(path, item.href));
}

function toBillingNavTab(section: BillingSectionConfig): BillingNavTab {
  const tab: BillingNavTab = {
    href: section.href,
    label: section.label,
    icon: section.icon,
  };

  if (section.href !== BILLING_CLIENTS_PATH) {
    return tab;
  }

  return {
    ...tab,
    menuItems: [
      {
        href: BILLING_CLIENTS_PATH,
        label: "Lista de clientes",
        icon: BookUser,
        iconTone: "blue",
      },
      {
        href: BILLING_DEBTORS_PATH,
        label: "Clientes con deuda",
        icon: FileText,
        iconTone: "red",
      },
    ],
  };
}

export const BILLING_NAV_TABS: BillingNavTab[] = [
  {
    href: BILLING_HUB_PATH,
    label: "Resumen",
    icon: LayoutDashboard,
    exact: true,
  },
  ...BILLING_SECTIONS.filter(
    (section) =>
      section.href !== BILLING_NEW_INVOICE_PATH &&
      section.href !== BILLING_DEBTORS_PATH,
  ).map(toBillingNavTab),
];
