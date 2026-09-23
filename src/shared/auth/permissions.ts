import type { UserRole } from "@/generated/prisma/client";

export type Permission =
  | "dashboard.read"
  | "catalogs.read"
  | "catalogs.create"
  | "catalogs.update"
  | "catalogs.delete"
  | "catalogs.import"
  | "prices.read"
  | "prices.create"
  | "prices.update"
  | "prices.delete"
  | "prices.import"
  | "invoices.read"
  | "invoices.create"
  | "invoices.update"
  | "invoices.delete"
  | "clients.read"
  | "clients.create"
  | "clients.update"
  | "clients.delete"
  | "movements.read"
  | "movements.create"
  | "movements.update"
  | "movements.delete"
  | "debts.read"
  | "categories.read"
  | "categories.create"
  | "categories.update"
  | "categories.delete"
  | "settings.read"
  | "settings.update"
  | "files.read"
  | "files.manage"
  | "users.read"
  | "users.manage"
  | "billing.hub.read";

const ALL_PERMISSIONS: readonly Permission[] = [
  "dashboard.read",
  "catalogs.read",
  "catalogs.create",
  "catalogs.update",
  "catalogs.delete",
  "catalogs.import",
  "prices.read",
  "prices.create",
  "prices.update",
  "prices.delete",
  "prices.import",
  "invoices.read",
  "invoices.create",
  "invoices.update",
  "invoices.delete",
  "clients.read",
  "clients.create",
  "clients.update",
  "clients.delete",
  "movements.read",
  "movements.create",
  "movements.update",
  "movements.delete",
  "debts.read",
  "categories.read",
  "categories.create",
  "categories.update",
  "categories.delete",
  "settings.read",
  "settings.update",
  "files.read",
  "files.manage",
  "users.read",
  "users.manage",
  "billing.hub.read",
] as const;

const READ_ALL_EXCEPT_USERS: readonly Permission[] = ALL_PERMISSIONS.filter(
  (permission) =>
    permission.endsWith(".read") || permission === "billing.hub.read",
);

const ADVANCED_VISITOR_CREATES: readonly Permission[] = [
  "invoices.create",
  "clients.create",
  "movements.create",
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  VISITANTE: ["catalogs.read", "prices.read"],
  VENDEDOR: [
    "catalogs.read",
    "prices.read",
    "invoices.read",
    "invoices.create",
    "clients.read",
    "clients.create",
  ],
  VISITANTE_AVANZADO: [
    ...READ_ALL_EXCEPT_USERS,
    ...ADVANCED_VISITOR_CREATES,
  ],
  ADMINISTRADOR: ALL_PERMISSIONS,
};

export const USER_ROLES: readonly UserRole[] = [
  "VISITANTE",
  "VENDEDOR",
  "VISITANTE_AVANZADO",
  "ADMINISTRADOR",
] as const;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  VISITANTE: "Visitante",
  VENDEDOR: "Vendedor",
  VISITANTE_AVANZADO: "Visitante avanzado",
  ADMINISTRADOR: "Administrador",
};

export type RoleTone =
  | "visitor"
  | "seller"
  | "advancedVisitor"
  | "admin";

export const USER_ROLE_TONES: Record<UserRole, RoleTone> = {
  VISITANTE: "visitor",
  VENDEDOR: "seller",
  VISITANTE_AVANZADO: "advancedVisitor",
  ADMINISTRADOR: "admin",
};

type RoutePermissionRule = {
  prefix: string;
  permission: Permission;
};

const ROUTE_PERMISSION_RULES: readonly RoutePermissionRule[] = [
  { prefix: "/admin/usuarios", permission: "users.manage" },
  { prefix: "/admin/archivos", permission: "files.read" },
  { prefix: "/admin/inicio", permission: "dashboard.read" },
  { prefix: "/admin/catalogos", permission: "catalogs.read" },
  { prefix: "/admin/precios", permission: "prices.read" },
  {
    prefix: "/admin/facturacion/nueva-factura",
    permission: "invoices.read",
  },
  {
    prefix: "/admin/facturacion/comprobantes",
    permission: "invoices.read",
  },
  {
    prefix: "/admin/facturacion/facturas",
    permission: "invoices.read",
  },
  {
    prefix: "/admin/facturacion/clientes",
    permission: "clients.read",
  },
  {
    prefix: "/admin/facturacion/deudores",
    permission: "debts.read",
  },
  {
    prefix: "/admin/facturacion/rubros",
    permission: "categories.read",
  },
  {
    prefix: "/admin/facturacion/movimientos",
    permission: "movements.read",
  },
  {
    prefix: "/admin/facturacion/pagos",
    permission: "movements.read",
  },
  {
    prefix: "/admin/facturacion/configuracion-fiscal",
    permission: "settings.read",
  },
  {
    prefix: "/admin/facturacion",
    permission: "billing.hub.read",
  },
];

export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: UserRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if (normalized === "/admin" || normalized === "") {
    return true;
  }

  if (normalized === "/admin/facturacion") {
    return hasAnyPermission(role, [
      "billing.hub.read",
      "invoices.read",
      "clients.read",
    ]);
  }

  let matched: RoutePermissionRule | undefined;
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (
      normalized === rule.prefix ||
      normalized.startsWith(`${rule.prefix}/`)
    ) {
      if (!matched || rule.prefix.length > matched.prefix.length) {
        matched = rule;
      }
    }
  }

  if (!matched) {
    return hasPermission(role, "dashboard.read");
  }

  return hasPermission(role, matched.permission);
}

export function resolveForbiddenRedirect(role: UserRole): string {
  if (hasPermission(role, "dashboard.read")) {
    return "/admin/inicio";
  }
  if (hasPermission(role, "catalogs.read")) {
    return "/admin/catalogos";
  }
  return "/admin/catalogos";
}

export function shouldFilterVisibilityForRole(role: UserRole): boolean {
  return role === "VISITANTE" || role === "VENDEDOR";
}
