import type {
  DashboardCatalogSummary,
  DashboardPriceListSummary,
} from "@/features/billing/data/dashboardTypes";
import { LastCatalogCard } from "@/features/billing/components/dashboard/LastCatalogCard";
import { LastPriceListCard } from "@/features/billing/components/dashboard/LastPriceListCard";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type DashboardRecentCardProps = {
  catalog: DashboardCatalogSummary | null;
  priceList: DashboardPriceListSummary | null;
};

export function DashboardRecentCard({
  catalog,
  priceList,
}: DashboardRecentCardProps) {
  return (
    <section className={`${styles.card} ${styles.actionsCard}`}>
      <div className={styles.actionsStack} aria-label="Recientes">
        <LastCatalogCard catalog={catalog} />
        <LastPriceListCard priceList={priceList} />
      </div>
    </section>
  );
}
