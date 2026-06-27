import type { Metadata } from "next";
import { CatalogNavigator } from "@/features/catalog/components/CatalogNavigator";
import { requireAuthOrRedirect } from "@/server/auth";
import { directoryService } from "@/server/services/directory.service";

export const metadata: Metadata = {
  title: "Catálogos | Admin Rothamel Repuestos",
};

export default async function AdminCatalogosPage() {
  const auth = await requireAuthOrRedirect("/admin");
  const directory = await directoryService.getDirectory();

  return (
    <CatalogNavigator
      catalogs={directory.catalogs}
      isAdmin={auth.profile.role === "ADMIN"}
    />
  );
}
