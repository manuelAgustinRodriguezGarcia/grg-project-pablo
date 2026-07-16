import {
  AdminSectionLoadingOverlay,
  AdminSectionTransitionProvider,
} from "@/features/admin/components/AdminSectionTransition";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { AdminQueryProvider } from "@/features/admin/providers/AdminQueryProvider";
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
    <AdminQueryProvider>
      <AdminSectionTransitionProvider>
        <div className={layoutStyles.shell}>
          <AdminSidebar userEmail={userEmail} userRole={auth.profile.role} />
          <main className={layoutStyles.content} data-admin-content>
            <div className={layoutStyles.contentBody}>{children}</div>
            <AdminSectionLoadingOverlay />
          </main>
        </div>
      </AdminSectionTransitionProvider>
    </AdminQueryProvider>
  );
}
