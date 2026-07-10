import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { FilesManager } from "@/features/files/components/FilesManager";
import { directoryService } from "@/server/services/directory.service";
import { requireAuthOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Archivos | Admin Rothamel Repuestos",
};

export default async function AdminArchivosPage() {
  const auth = await requireAuthOrRedirect("/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const directory = await directoryService.getDirectory();

  return (
    <FilesManager
      catalogs={directory.catalogs}
      isAdmin={adminAuth.isAdmin}
    />
  );
}
