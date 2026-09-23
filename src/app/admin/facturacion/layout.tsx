import type { Metadata } from "next";
import { requireAnyPermissionOrRedirect } from "@/server/auth";
import { BillingPillNav } from "@/features/billing/components/BillingPillNav";
import styles from "@/features/billing/styles/BillingSectionsLayout.module.scss";

export const metadata: Metadata = {
  title: "Facturación",
};

export default async function FacturacionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await requireAnyPermissionOrRedirect(
    ["billing.hub.read", "invoices.read", "clients.read"],
    "/admin/facturacion",
  );

  return (
    <div className={styles.shell}>
      <div className={styles.stickyChrome}>
        <BillingPillNav userRole={auth.profile.role} />
      </div>
      <div
        className={styles.content}
        data-admin-overlay-target
        data-admin-overlay-scope="/admin/facturacion"
      >
        {children}
      </div>
    </div>
  );
}
