import { redirect } from "next/navigation";
import {
  ADMIN_DASHBOARD_PATH,
  requireAuthOrRedirect,
  USER_HOME_PATH,
} from "@/server/auth";

export default async function AdminPage() {
  const auth = await requireAuthOrRedirect("/admin");

  if (auth.profile.role === "ADMIN") {
    redirect(ADMIN_DASHBOARD_PATH);
  }

  redirect(USER_HOME_PATH);
}
