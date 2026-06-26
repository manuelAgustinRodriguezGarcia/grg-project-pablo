import type { Metadata } from "next";
import { FilesManager } from "@/features/files/components/FilesManager";
import { directoryService } from "@/server/services/directory.service";

export const metadata: Metadata = {
  title: "Archivos | Admin Rothamel Repuestos",
};

export default async function AdminArchivosPage() {
  const directory = await directoryService.getDirectory();

  return <FilesManager catalogs={directory.catalogs} />;
}
