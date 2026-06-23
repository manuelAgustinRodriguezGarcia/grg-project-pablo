import { redirect } from "next/navigation";
import { ADMIN_HOME_PATH } from "@/server/auth/config";

export default function AdminPage() {
  redirect(ADMIN_HOME_PATH);
}
