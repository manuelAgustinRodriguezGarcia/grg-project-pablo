import type { Metadata } from "next";
import { CatalogNavigator } from "@/features/catalog/components/CatalogNavigator";
import { mockCatalogs } from "@/features/catalog/data/mockCatalogNavigator.data";

export const metadata: Metadata = {
  title: "Catálogos | Admin Rothamel Repuestos",
};

export default function AdminCatalogosPage() {
  return <CatalogNavigator catalogs={mockCatalogs} />;
}
