import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RolePermissionsPanel } from "@/features/permissions/components/RolePermissionsPanel";
import { toRolePermissionItem } from "@/features/permissions/types/permission.types";
import { requireAuthOrRedirect } from "@/server/auth";
import { rolePermissionService } from "@/server/services/role-permission.service";

export const metadata: Metadata = {
  title: "Permisos | Admin Rothamel Repuestos",
};

export default async function AdminPermisosPage() {
  const auth = await requireAuthOrRedirect("/admin/permisos");

  if (auth.profile.role !== "ADMIN") {
    redirect("/admin/catalogos");
  }

  const rows = await rolePermissionService.listForRole("USUARIO");

  return (
    <RolePermissionsPanel items={rows.map(toRolePermissionItem)} />
  );
}
