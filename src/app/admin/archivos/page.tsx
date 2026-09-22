import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { FilesManager } from "@/features/files/components/FilesManager";
import { directoryService } from "@/server/services/directory.service";
import { requirePermissionOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Archivos",
};

export default async function AdminArchivosPage() {
  const auth = await requirePermissionOrRedirect("files.read", "/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const directory = await directoryService.getDirectory();

  return (
    <FilesManager
      catalogs={directory.catalogs}
      isAdmin={adminAuth.canManageFiles}
    />
  );
}
