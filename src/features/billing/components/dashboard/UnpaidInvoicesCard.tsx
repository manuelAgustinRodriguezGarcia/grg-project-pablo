import Link from "next/link";
import {
  BILLING_DEBTORS_PATH,
  billingInvoiceDetailHref,
} from "@/features/billing/data/billingNav";
import type { DashboardUnpaidInvoice } from "@/features/billing/data/dashboardTypes";
import { formatArs } from "@/features/billing/utils/format-ars";
import { AlertTriangle, ICON_STROKE, Sticker } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type UnpaidInvoicesCardProps = {
  invoices: readonly DashboardUnpaidInvoice[];
};

export function UnpaidInvoicesCard({ invoices }: UnpaidInvoicesCardProps) {
  return (
    <section className={`${styles.card} ${styles.unpaidCard}`}>
      <div className={styles.cardHeading}>
        <span className={`${styles.cardIcon} ${styles.cardIconRed}`} aria-hidden>
          <AlertTriangle strokeWidth={ICON_STROKE} />
        </span>
        <h2 className={styles.cardTitle}>Facturas impagas</h2>
      </div>
      {invoices.length === 0 ? (
        <div className={styles.emptyHint} role="status">
          <Sticker className={styles.emptyHintIcon} strokeWidth={ICON_STROKE} aria-hidden />
          <p className={styles.emptyHintText}>No hay facturas con saldo pendiente.</p>
        </div>
      ) : (
        <ul className={styles.unpaidList}>
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={billingInvoiceDetailHref(invoice.id)}
                className={styles.unpaidItem}
              >
                <div>
                  <p className={styles.unpaidNumber}>{invoice.number}</p>
                  <p className={styles.unpaidMeta}>
                    {invoice.clientName} · {invoice.dueLabel}
                  </p>
                </div>
                <strong className={styles.unpaidAmount}>
                  {formatArs(invoice.total)}
                </strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={BILLING_DEBTORS_PATH} className={styles.cardFooterLink}>
        Ver clientes con deuda
      </Link>
    </section>
  );
}
