import type {
  BillingRubro,
  BillingRubroStatus,
} from "@/generated/prisma/client";

export type BillingRubroActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type BillingRubroListItem = Pick<
  BillingRubro,
  | "id"
  | "code"
  | "name"
  | "description"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

export const RUBRO_STATUS_LABELS: Record<BillingRubroStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

export function toBillingRubroListItem(
  rubro: BillingRubro,
): BillingRubroListItem {
  return {
    id: rubro.id,
    code: rubro.code,
    name: rubro.name,
    description: rubro.description,
    status: rubro.status,
    createdAt: rubro.createdAt,
    updatedAt: rubro.updatedAt,
  };
}
