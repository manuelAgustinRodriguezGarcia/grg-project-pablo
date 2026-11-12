"use client";

import { useQuery } from "@tanstack/react-query";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { adminQueryKeys } from "@/features/admin/query-keys";
import type {
  StatisticsClientsResponse,
  StatisticsRubrosResponse,
  StatisticsSummaryResponse,
} from "@/features/billing/types/billing-statistics.types";
import {
  fetchBillingStatistics,
  fetchBillingStatisticsYear,
} from "@/features/billing/utils/billing-statistics-client";
import {
  statisticsScopeKey,
  type StatisticsPeriodSelection,
  statisticsRequestSearch,
} from "@/features/billing/utils/billing-statistics-period";

type StatisticsResource = "summary" | "clients" | "rubros";

function sameEntityScope(
  environment: BillingFiscalEnvironment,
  resource: StatisticsResource,
  search: string,
  previousQuery: { queryKey: readonly unknown[] } | undefined,
): boolean {
  const key = previousQuery?.queryKey;
  if (!key || key[2] !== environment || key[3] !== resource) {
    return false;
  }

  return statisticsScopeKey(String(key[4] ?? "")) === statisticsScopeKey(search);
}

function useStatisticsQuery<T>(input: {
  environment: BillingFiscalEnvironment;
  resource: StatisticsResource;
  search: string;
  enabled: boolean;
  keepRankingWhileSelecting: boolean;
}) {
  return useQuery({
    queryKey: adminQueryKeys.billingStatistics(
      input.environment,
      input.resource,
      input.search,
    ),
    enabled: input.enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const payload = await fetchBillingStatistics(
        input.resource,
        input.search,
        input.environment,
        signal,
      );
      return payload as T;
    },
    placeholderData: input.keepRankingWhileSelecting
      ? (previous, previousQuery) => {
          if (!previous || !sameEntityScope(input.environment, input.resource, input.search, previousQuery)) {
            return undefined;
          }
          return previous;
        }
      : undefined,
  });
}

export function useBillingStatisticsYear(input: {
  environment: BillingFiscalEnvironment;
  year: number;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: adminQueryKeys.billingStatisticsYear(input.environment, input.year),
    enabled: input.enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) => fetchBillingStatisticsYear(input.year, input.environment, signal),
  });
}

export function invalidateBillingStatistics(
  queryClient: { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> },
) {
  return queryClient.invalidateQueries({
    queryKey: adminQueryKeys.billingStatisticsRoot(),
  });
}

export function useBillingStatisticsSummary(input: {
  environment: BillingFiscalEnvironment;
  period: StatisticsPeriodSelection;
  comparison: StatisticsPeriodSelection | null;
  enabled: boolean;
}) {
  const search = statisticsRequestSearch({
    period: input.period,
    comparison: input.comparison,
  });

  return useStatisticsQuery<StatisticsSummaryResponse>({
    environment: input.environment,
    resource: "summary",
    search,
    enabled: input.enabled,
    keepRankingWhileSelecting: false,
  });
}

export function useBillingStatisticsClients(input: {
  environment: BillingFiscalEnvironment;
  period: StatisticsPeriodSelection;
  comparison: StatisticsPeriodSelection | null;
  clientKey: string | null;
  enabled: boolean;
}) {
  const search = statisticsRequestSearch({
    period: input.period,
    comparison: input.comparison,
    clientKey: input.clientKey,
  });

  return useStatisticsQuery<StatisticsClientsResponse>({
    environment: input.environment,
    resource: "clients",
    search,
    enabled: input.enabled,
    keepRankingWhileSelecting: true,
  });
}

export function useBillingStatisticsRubros(input: {
  environment: BillingFiscalEnvironment;
  period: StatisticsPeriodSelection;
  comparison: StatisticsPeriodSelection | null;
  rubroKey: string | null;
  enabled: boolean;
}) {
  const search = statisticsRequestSearch({
    period: input.period,
    comparison: input.comparison,
    rubroKey: input.rubroKey,
  });

  return useStatisticsQuery<StatisticsRubrosResponse>({
    environment: input.environment,
    resource: "rubros",
    search,
    enabled: input.enabled,
    keepRankingWhileSelecting: true,
  });
}
