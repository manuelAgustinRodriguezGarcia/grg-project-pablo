import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { ADMIN_USER_EMAIL_FALLBACK } from "@/features/admin/data/adminNav";
import layoutStyles from "@/features/admin/styles/adminLayout.module.scss";
import { requireAuthOrRedirect } from "@/server/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await requireAuthOrRedirect("/admin");
  const userEmail =
    auth.supabaseUser.email ??
    auth.profile.email ??
    ADMIN_USER_EMAIL_FALLBACK;

  return (
    <div className={layoutStyles.shell}>
      <AdminSidebar userEmail={userEmail} />
      <main className={layoutStyles.content}>{children}</main>
    </div>
  );
}
