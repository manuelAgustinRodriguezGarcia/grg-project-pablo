"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdminSectionTransition } from "@/features/admin/components/AdminSectionTransition";
import { TopRankCard } from "@/features/billing/components/dashboard/TopRankCard";
import { useUnsavedInvoiceDraft } from "@/features/billing/components/invoices/UnsavedInvoiceDraftContext";
import { BILLING_DEBTORS_PATH } from "@/features/billing/data/billingNav";
import type { DashboardTopItem } from "@/features/billing/data/dashboardTypes";
import type { ClientDebtItem } from "@/features/billing/utils/invoice-list";
import { formatArs } from "@/features/billing/utils/format-ars";
import {
  BookUser,
  ChevronDown,
  FileText,
  ICON_STROKE,
  Sticker,
} from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type ClientsInsightsPanelProps = {
  topClients: readonly DashboardTopItem[];
  debtorClients: readonly ClientDebtItem[];
};

export function ClientsInsightsPanel({
  topClients,
  debtorClients,
}: ClientsInsightsPanelProps) {
  const sectionTransition = useAdminSectionTransition();
  const unsavedDraft = useUnsavedInvoiceDraft();
  const listRef = useRef<HTMLUListElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const updateScrollHint = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      setShowScrollHint(false);
      return;
    }

    const hasOverflow = list.scrollHeight > list.clientHeight + 1;
    const atBottom =
      list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
    setShowScrollHint(hasOverflow && !atBottom);
  }, []);

  useEffect(() => {
    updateScrollHint();

    const list = listRef.current;
    if (!list) {
      return;
    }

    list.addEventListener("scroll", updateScrollHint, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollHint);
    resizeObserver.observe(list);

    return () => {
      list.removeEventListener("scroll", updateScrollHint);
      resizeObserver.disconnect();
    };
  }, [debtorClients.length, updateScrollHint]);

  return (
    <aside className={styles.insightsColumn} aria-label="Indicadores de clientes">
      <TopRankCard
        className={styles.insightRankCard}
        title="Máximos compradores"
        items={topClients}
        icon={BookUser}
        showRankIndex={false}
      />

      <Link
        href={BILLING_DEBTORS_PATH}
        className={`${styles.insightPanel} ${styles.insightDebtPanel} ${styles.insightDebtPanelLink}`}
        aria-label="Ver todos los deudores"
        onClick={(event) => {
          if (
            unsavedDraft?.interceptLeave(event, BILLING_DEBTORS_PATH, {
              exact: true,
            })
          ) {
            return;
          }

          sectionTransition?.beginNavigation(BILLING_DEBTORS_PATH, {
            exact: true,
          });
        }}
      >
        <div className={styles.insightPanelHeader}>
          <div className={styles.insightPanelHeading}>
            <span className={styles.insightDebtHeaderIconWrap} aria-hidden>
              <FileText
                className={styles.insightDebtHeaderIcon}
                strokeWidth={ICON_STROKE}
              />
            </span>
            <h2 className={styles.insightPanelTitle}>Deudores</h2>
          </div>
          {debtorClients.length > 0 ? (
            <p className={styles.insightPanelMeta}>
              {debtorClients.length}{" "}
              {debtorClients.length === 1 ? "cliente" : "clientes"}
            </p>
          ) : null}
        </div>

        <div className={styles.insightDebtListWrap}>
          {debtorClients.length === 0 ? (
            <div className={styles.insightDebtEmpty} role="status">
              <Sticker
                className={styles.insightDebtEmptyIcon}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              <p className={styles.insightDebtEmptyText}>
                No hay ningún cliente con deuda
              </p>
            </div>
          ) : (
            <>
              <ul ref={listRef} className={styles.insightDebtList}>
                {debtorClients.map((client) => (
                  <li key={client.clientId}>
                    <div className={styles.insightDebtItem}>
                      <div className={styles.insightDebtBody}>
                        <p className={styles.insightDebtName}>{client.name}</p>
                        <p className={styles.insightDebtMeta}>
                          {client.invoicesCount}{" "}
                          {client.invoicesCount === 1
                            ? "factura"
                            : "facturas"}
                        </p>
                      </div>
                      <strong className={styles.insightDebtAmount}>
                        {formatArs(client.outstanding)}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
              {showScrollHint ? (
                <div className={styles.insightDebtScrollHint} aria-hidden>
                  <ChevronDown
                    className={styles.insightDebtScrollHintIcon}
                    strokeWidth={ICON_STROKE}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </Link>
    </aside>
  );
}
