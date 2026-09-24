import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/shared/auth/permissions";
import {
  ArrowLeftRight,
  BookUser,
  Cog,
  FileSpreadsheet,
  FileText,
  Printer,
  ReceiptText,
  Search,
  Tags,
} from "@/shared/icons";

export type BillingGuidePermission = Permission | readonly Permission[];

export type BillingGuideStep = {
  id: string;
  title?: string;
  text: string;
  icon?: LucideIcon;
};

export type BillingGuideVisualAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
};

export type BillingGuideInfoBlock = {
  id: string;
  title?: string;
  text: string;
  tone?: "info" | "warning";
};

export type BillingGuideArticle = {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  permission?: BillingGuidePermission;
  introduction?: string;
  steps?: readonly BillingGuideStep[];
  visualActions?: readonly BillingGuideVisualAction[];
  infoBlocks?: readonly BillingGuideInfoBlock[];
};

export type BillingGuideCategory = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  permission?: BillingGuidePermission;
  articles: readonly BillingGuideArticle[];
};

export const BILLING_GUIDE_CATEGORIES: readonly BillingGuideCategory[] = [
  {
    id: "new-invoice",
    title: "Crear una factura",
    description: "Emití un comprobante desde Nueva factura.",
    icon: ReceiptText,
    permission: "invoices.create",
    articles: [
      {
        id: "how-create-invoice",
        title: "¿Cómo creo una nueva factura?",
        description: "El camino más rápido para emitir un comprobante.",
        icon: ReceiptText,
        permission: "invoices.create",
        introduction:
          "Esta guía te va a mostrar cómo emitir una factura en modo prueba, con los mismos botones que ves en el sistema.",
        steps: [],
        visualActions: [],
        infoBlocks: [],
      },
    ],
  },
  {
    id: "clients",
    title: "Clientes",
    description: "Altas, consulta y datos de tus clientes.",
    icon: BookUser,
    permission: "clients.read",
    articles: [
      {
        id: "how-create-client",
        title: "¿Dónde cargo un nuevo cliente?",
        description: "Desde Clientes o mientras armás una factura.",
        icon: BookUser,
        permission: "clients.create",
        introduction:
          "Esta guía te va a indicar dónde abrir el formulario para cargar un cliente nuevo.",
        steps: [],
        visualActions: [],
        infoBlocks: [],
      },
    ],
  },
  {
    id: "rubros",
    title: "Rubros",
    description: "Los conceptos que usás al facturar.",
    icon: Tags,
    permission: "categories.read",
    articles: [
      {
        id: "how-create-rubro",
        title: "¿Cómo creo un nuevo rubro?",
        description: "Agregá un concepto para usarlo en las facturas.",
        icon: Tags,
        permission: "categories.update",
        introduction:
          "Esta guía te va a mostrar cómo crear un rubro para después elegirlo en una factura.",
        steps: [],
        visualActions: [],
        infoBlocks: [],
      },
    ],
  },
  {
    id: "invoices",
    title: "Facturas",
    description: "Historial, búsqueda e impresión de comprobantes.",
    icon: FileText,
    permission: "invoices.read",
    articles: [
      {
        id: "how-search-invoice",
        title: "¿Cómo busco una factura?",
        description: "Encontrá un comprobante por cliente o número.",
        icon: Search,
        permission: "invoices.read",
        introduction:
          "Esta guía te va a mostrar cómo usar el buscador y los filtros de la lista de facturas.",
        steps: [],
        visualActions: [],
        infoBlocks: [],
      },
      {
        id: "how-print-invoice",
        title: "¿Cómo imprimo una factura?",
        description: "Imprimí un comprobante desde la lista o el detalle.",
        icon: Printer,
        permission: "invoices.read",
        introduction:
          "Esta guía te va a indicar dónde está el botón Imprimir y qué ocurre después de usarlo.",
        steps: [],
        visualActions: [],
        infoBlocks: [],
      },
    ],
  },
  {
    id: "movements",
    title: "Recibos y movimientos",
    description: "Cobranzas, imputaciones y el listado de movimientos.",
    icon: ArrowLeftRight,
    permission: "movements.read",
    articles: [],
  },
  {
    id: "notes",
    title: "Notas de crédito y débito",
    description: "Ajustes sobre facturas ya emitidas.",
    icon: FileText,
    permission: "movements.read",
    articles: [],
  },
  {
    id: "libro-iva",
    title: "Libro IVA",
    description: "Informes mensuales, diarios o por período.",
    icon: FileSpreadsheet,
    permission: "invoices.read",
    articles: [],
  },
  {
    id: "search",
    title: "Búsquedas y filtros",
    description: "Encontrá clientes, rubros y comprobantes más rápido.",
    icon: Search,
    articles: [],
  },
  {
    id: "print",
    title: "Impresión, PDF y compartir",
    description: "Imprimí, descargá o enviá un comprobante en PDF.",
    icon: Printer,
    articles: [],
  },
  {
    id: "settings",
    title: "Configuración",
    description: "IVA, límite de cliente genérico y ambiente.",
    icon: Cog,
    permission: "settings.read",
    articles: [],
  },
];

export function canAccessBillingGuideEntry(
  role: UserRole,
  permission?: BillingGuidePermission,
): boolean {
  if (permission == null) {
    return true;
  }

  if (typeof permission === "string") {
    return hasPermission(role, permission);
  }

  return hasAnyPermission(role, permission);
}

export function filterBillingGuideCategories(
  role: UserRole,
  categories: readonly BillingGuideCategory[] = BILLING_GUIDE_CATEGORIES,
): BillingGuideCategory[] {
  return categories
    .filter((category) => canAccessBillingGuideEntry(role, category.permission))
    .map((category) => ({
      ...category,
      articles: category.articles.filter((article) =>
        canAccessBillingGuideEntry(role, article.permission),
      ),
    }));
}

export function findBillingGuideCategory(
  categories: readonly BillingGuideCategory[],
  categoryId: string,
): BillingGuideCategory | undefined {
  return categories.find((category) => category.id === categoryId);
}

export function findBillingGuideArticle(
  category: BillingGuideCategory,
  articleId: string,
): BillingGuideArticle | undefined {
  return category.articles.find((article) => article.id === articleId);
}
