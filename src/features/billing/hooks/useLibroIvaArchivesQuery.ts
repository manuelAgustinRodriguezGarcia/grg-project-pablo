import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { adminQueryKeys } from "@/features/admin/query-keys";
import type { LibroIvaArchiveDetail } from "@/features/billing/types/libro-iva-archive.types";
import {
  fetchLibroIvaArchiveDetail,
  fetchLibroIvaArchivePresence,
  fetchLibroIvaArchives,
} from "@/features/billing/utils/libro-iva-archive-client";

export type LibroIvaArchiveDetailState = {
  archive: LibroIvaArchiveDetail | null;
  failed: boolean;
};

export function forgetLibroIvaArchiveQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: adminQueryKeys.billingLibroIvaArchives() });
  queryClient.removeQueries({ queryKey: adminQueryKeys.billingLibroIvaArchiveDetails() });
  queryClient.removeQueries({ queryKey: adminQueryKeys.billingLibroIvaArchivePresence() });
}

export function useLibroIvaArchivesQuery(environment: BillingFiscalEnvironment) {
  return useQuery({
    queryKey: adminQueryKeys.billingLibroIvaArchives(environment),
    queryFn: fetchLibroIvaArchives,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useLibroIvaArchivePresenceQuery(
  environment: BillingFiscalEnvironment,
  ids: readonly string[],
) {
  const sortedIds = [...new Set(ids)].sort();

  return useQuery({
    queryKey: adminQueryKeys.billingLibroIvaArchivePresence(environment, sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const files = await fetchLibroIvaArchivePresence(sortedIds);
      return Object.fromEntries(
        files.map((file) => [file.id, file.filePresent]),
      ) as Record<string, boolean | null>;
    },
  });
}

export function useLibroIvaArchiveDetailsQuery(
  environment: BillingFiscalEnvironment,
  ids: readonly string[],
  enabled: boolean,
) {
  const sortedIds = [...ids].sort();

  return useQuery({
    queryKey: adminQueryKeys.billingLibroIvaArchiveDetails(environment, sortedIds),
    enabled: enabled && sortedIds.length > 0 && sortedIds.length <= 4,
    staleTime: 30_000,
    queryFn: async () => {
      const entries = await Promise.all(
        sortedIds.map(async (id) => {
          try {
            const archive = await fetchLibroIvaArchiveDetail(id);
            return [id, { archive, failed: false }] as const;
          } catch {
            return [id, { archive: null, failed: true }] as const;
          }
        }),
      );

      return Object.fromEntries(entries) as Record<string, LibroIvaArchiveDetailState>;
    },
  });
}
