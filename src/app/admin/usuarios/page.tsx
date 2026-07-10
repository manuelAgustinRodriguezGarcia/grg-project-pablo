import type { Metadata } from "next";
import { UsersManager } from "@/features/users/components/UsersManager";
import { listUsersAction } from "@/features/users/actions/user.actions";
import { requireAdminOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Usuarios | Admin Rothamel Repuestos",
};

export default async function AdminUsuariosPage() {
  const auth = await requireAdminOrRedirect("/admin");
  const usersResult = await listUsersAction();

  return (
    <UsersManager
      initialUsers={usersResult.success ? usersResult.data : []}
      currentUserId={auth.profile.id}
    />
  );
}
