import type {
  DashboardCatalogSummary,
  DashboardPriceListSummary,
} from "@/features/billing/data/dashboardTypes";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatUpdatedAtLabel(date: Date, verb: "Actualizado" | "Actualizada"): string {
  return `${verb} el ${UPDATED_AT_FORMATTER.format(date)}`;
}

export type DashboardRecentSummaries = {
  lastCatalog: DashboardCatalogSummary | null;
  lastPriceList: DashboardPriceListSummary | null;
};

export class DashboardService {
  async getRecentSummaries(): Promise<DashboardRecentSummaries> {
    const [catalog, priceList] = await Promise.all([
      catalogRepository.findLatestUpdated(),
      priceListRepository.findLatestUpdated(),
    ]);

    return {
      lastCatalog: catalog
        ? {
            name: catalog.name,
            updatedAtLabel: formatUpdatedAtLabel(catalog.updatedAt, "Actualizado"),
            href: `/admin/catalogos?catalog=${encodeURIComponent(catalog.id)}`,
          }
        : null,
      lastPriceList: priceList
        ? {
            name: priceList.name,
            updatedAtLabel: formatUpdatedAtLabel(
              priceList.updatedAt,
              "Actualizada",
            ),
            href: `/admin/precios?list=${encodeURIComponent(priceList.id)}`,
          }
        : null,
    };
  }
}

export const dashboardService = new DashboardService();
