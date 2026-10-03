import "server-only";
import { prisma } from "@/server/database/prisma";
import { acquireArcaTicketLock } from "@/server/arca/tickets/advisory-lock";

/**
 * El login WSAA corre dentro de esta transacción, con el advisory lock tomado,
 * para que otra instancia no dispare un segundo loginCms.
 *
 * Timeout 45s: alcanza para esperar el lock de otra instancia y el timeout
 * de WSAA (15s). pg_advisory_xact_lock se libera al terminar la transacción.
 */
const TICKET_LOCK_MAX_WAIT_MS = 20_000;
const TICKET_LOCK_TIMEOUT_MS = 45_000;

export async function withArcaTicketLock<T>(
  context: string,
  task: (db: unknown) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await acquireArcaTicketLock(tx, context);
      return task(tx);
    },
    {
      maxWait: TICKET_LOCK_MAX_WAIT_MS,
      timeout: TICKET_LOCK_TIMEOUT_MS,
    },
  );
}
