import { redirect } from "next/navigation";
import { getRoleHomePath, requireAuthOrRedirect } from "@/server/auth";

export default async function AdminPage() {
  const auth = await requireAuthOrRedirect("/admin");
  redirect(getRoleHomePath(auth.profile.role));
}
