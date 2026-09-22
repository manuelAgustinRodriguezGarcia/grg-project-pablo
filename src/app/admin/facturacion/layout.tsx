import type { Metadata } from "next";
import { requireAnyPermissionOrRedirect } from "@/server/auth";
import { BillingPillNav } from "@/features/billing/components/BillingPillNav";
import { ICON_STROKE, ReceiptText } from "@/shared/icons";
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
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>
            <ReceiptText
              className={styles.headerTitleIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            Facturación
          </h1>
        </header>
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
