import type { Metadata } from "next";
import { FilesManager } from "@/features/files/components/FilesManager";
import { directoryService } from "@/server/services/directory.service";
import { requireAuthOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Archivos | Admin Rothamel Repuestos",
};

export default async function AdminArchivosPage() {
  const auth = await requireAuthOrRedirect("/admin");
  const directory = await directoryService.getDirectory();

  return (
    <FilesManager
      catalogs={directory.catalogs}
      isAdmin={auth.profile.role === "ADMIN"}
    />
  );
}
