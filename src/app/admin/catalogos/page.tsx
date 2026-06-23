import type { Metadata } from "next";
import { CatalogNavigator } from "@/features/catalog/components/CatalogNavigator";
import { directoryService } from "@/server/services/directory.service";

export const metadata: Metadata = {
  title: "Catálogos | Admin Rothamel Repuestos",
};

export default async function AdminCatalogosPage() {
  const directory = await directoryService.getDirectory();

  return <CatalogNavigator catalogs={directory.catalogs} />;
}
