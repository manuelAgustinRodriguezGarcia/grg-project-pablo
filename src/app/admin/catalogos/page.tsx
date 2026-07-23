import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { CatalogNavigator } from "@/features/catalog/components/CatalogNavigator";
import { requireAuthOrRedirect } from "@/server/auth";
import { directoryService } from "@/server/services/directory.service";

export const metadata: Metadata = {
  title: "Catálogos",
};

type AdminCatalogosPageProps = {
  searchParams: Promise<{
    catalog?: string | string[];
    folder?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AdminCatalogosPage({
  searchParams,
}: AdminCatalogosPageProps) {
  const auth = await requireAuthOrRedirect("/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const params = await searchParams;
  const directory = await directoryService.getDirectory();

  return (
    <CatalogNavigator
      catalogs={directory.catalogs}
      initialCatalogId={firstParam(params.catalog)}
      initialFolderId={firstParam(params.folder)}
      canEdit={adminAuth.canEdit}
      isAdmin={adminAuth.isAdmin}
      enableColumnFilters
    />
  );
}
