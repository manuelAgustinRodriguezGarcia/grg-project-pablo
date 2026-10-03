import "server-only";
import { prisma } from "@/server/database/prisma";
import type { ArcaEmissionLock } from "@/server/arca/invoices/emission-store";
export { arcaEmissionLockScope } from "@/server/arca/invoices/emission-store";

const EMISSION_LOCK_MAX_WAIT_MS = 20_000;
/**
 * La transacción espera red: ticket (hasta 15s), último autorizado (15s)
 * y FECAESolicitar (15s), más margen de base. No es un timeout infinito.
 * La transacción no escribe la emisión: solo toma pg_advisory_xact_lock.
 * SENDING se confirma en otra conexión antes del request, así un corte
 * no revierte el número ya reservado ni libera un segundo FECAESolicitar.
 */
const EMISSION_LOCK_TIMEOUT_MS = 70_000;

export const withArcaEmissionLock: ArcaEmissionLock = (scope, task) => {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
      return task();
    },
    {
      maxWait: EMISSION_LOCK_MAX_WAIT_MS,
      timeout: EMISSION_LOCK_TIMEOUT_MS,
    },
  );
};
