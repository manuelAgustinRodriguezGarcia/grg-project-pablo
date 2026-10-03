import "server-only";

type SqlExecutor = {
  $executeRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

/**
 * Lock de transacción de Postgres. Se libera al commit o rollback.
 * La identidad viaja como parámetro, no concatenada en el SQL.
 */
export async function acquireArcaTicketLock(
  db: SqlExecutor,
  context: string,
): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context}, 0))`;
}
