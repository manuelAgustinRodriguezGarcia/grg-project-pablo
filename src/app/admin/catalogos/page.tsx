import type { Metadata } from "next";
import { CatalogNavigator } from "@/features/catalog/components/CatalogNavigator";
import { requireAuthOrRedirect } from "@/server/auth";
import { directoryService } from "@/server/services/directory.service";

export const metadata: Metadata = {
  title: "Catálogos | Admin Rothamel Repuestos",
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
  const params = await searchParams;
  const directory = await directoryService.getDirectory();

  return (
    <CatalogNavigator
      catalogs={directory.catalogs}
      initialCatalogId={firstParam(params.catalog)}
      initialFolderId={firstParam(params.folder)}
      isAdmin={auth.profile.role === "ADMIN"}
      enableColumnFilters
    />
  );
}
