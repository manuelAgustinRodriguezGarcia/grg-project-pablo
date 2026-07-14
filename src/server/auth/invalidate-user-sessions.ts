import { prisma } from "@/server/database/prisma";

/**
 * Cierra todas las sesiones Auth de un usuario por su id.
 *
 * `supabase.auth.admin.signOut(jwt, scope)` espera un JWT de acceso, no un
 * user id. Invalidamos borrando filas en `auth.sessions` (mismo efecto que
 * el logout global de GoTrue).
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM auth.sessions WHERE user_id = ${userId}::uuid
  `;
}
