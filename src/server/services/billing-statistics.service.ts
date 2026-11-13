import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { BILLING_STATISTICS_FIRST_YEAR } from "@/features/billing/utils/billing-statistics-period";
import { requirePermission } from "@/server/auth";
import { AuthForbiddenError } from "@/server/auth/errors";
import { canAccessBillingStatisticsAndLibros } from "@/shared/auth/billing-section-access";
import { billingStatisticsRepository } from "@/server/repositories/billing-statistics.repository";
import { readActiveFiscalEnvironment } from "@/server/services/billing-fiscal-scope";
import {
  aggregateStatistics,
  type StatisticsAggregate,
} from "@/server/services/billing-statistics/aggregate";
import {
  presentClients,
  presentRubros,
  presentSummary,
} from "@/server/services/billing-statistics/present";
import {
  parseStatisticsQuery,
  parseStatisticsYearQuery,
  type ResolvedStatisticsQuery,
} from "@/server/services/billing-statistics/query";
import { statisticsYearRange } from "@/server/services/billing-statistics/periods";
import { presentStatisticsYear } from "@/server/services/billing-statistics/year";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";

type LoadedStatistics = {
  environment: BillingFiscalEnvironment;
  query: ResolvedStatisticsQuery;
  current: StatisticsAggregate;
  comparison: {
    period: ResolvedStatisticsQuery["period"];
    aggregate: StatisticsAggregate;
  } | null;
};

export class BillingStatisticsService {
  async getSummary(searchParams: URLSearchParams) {
    const loaded = await this.load("summary", searchParams);
    return presentSummary({
      environment: loaded.environment,
      period: loaded.query.period,
      current: loaded.current,
      comparison: loaded.comparison,
    });
  }

  async getClients(searchParams: URLSearchParams) {
    const loaded = await this.load("clients", searchParams);
    return presentClients({
      environment: loaded.environment,
      period: loaded.query.period,
      current: loaded.current,
      comparison: loaded.comparison,
      limit: loaded.query.limit,
      clientKey: loaded.query.clientKey,
    });
  }

  async getYear(searchParams: URLSearchParams) {
    await this.authorize();
    const year = parseStatisticsYearQuery(searchParams);
    let range;
    try {
      range = statisticsYearRange(year);
    } catch (error) {
      throw new BillingInvoiceError(
        error instanceof Error ? error.message : "Indicá un año válido.",
        "VALIDATION_ERROR",
      );
    }

    const environment = await readActiveFiscalEnvironment();
    const source = await billingStatisticsRepository.findSource(range, environment);
    return presentStatisticsYear({
      environment,
      year,
      aggregate: aggregateStatistics(source),
      source,
    });
  }

  async listInvoicedYears(now = new Date()): Promise<number[]> {
    await this.authorize();
    const lastYear = now.getFullYear();
    if (lastYear < BILLING_STATISTICS_FIRST_YEAR) {
      return [];
    }

    const environment = await readActiveFiscalEnvironment();
    return billingStatisticsRepository.findInvoicedYears(
      environment,
      BILLING_STATISTICS_FIRST_YEAR,
      lastYear,
    );
  }

  async getRubros(searchParams: URLSearchParams) {
    const loaded = await this.load("rubros", searchParams);
    return presentRubros({
      environment: loaded.environment,
      period: loaded.query.period,
      current: loaded.current,
      comparison: loaded.comparison,
      limit: loaded.query.limit,
      rubroKey: loaded.query.rubroKey,
    });
  }

  private async authorize() {
    const auth = await requirePermission("statistics.read");
    if (!canAccessBillingStatisticsAndLibros(auth.profile.role)) {
      throw new AuthForbiddenError();
    }
  }

  private async load(
    scope: ResolvedStatisticsQuery["scope"],
    searchParams: URLSearchParams,
  ): Promise<LoadedStatistics> {
    await this.authorize();
    const query = parseStatisticsQuery(searchParams, scope);
    const environment = await readActiveFiscalEnvironment();
    const [currentSource, comparisonSource] = await Promise.all([
      billingStatisticsRepository.findSource(query.period.range, environment),
      query.comparison
        ? billingStatisticsRepository.findSource(query.comparison.range, environment)
        : Promise.resolve(null),
    ]);

    return {
      environment,
      query,
      current: aggregateStatistics(currentSource),
      comparison: query.comparison
        ? {
            period: query.comparison,
            aggregate: aggregateStatistics(
              comparisonSource ?? { invoices: [], notes: [] },
            ),
          }
        : null,
    };
  }
}

export const billingStatisticsService = new BillingStatisticsService();
