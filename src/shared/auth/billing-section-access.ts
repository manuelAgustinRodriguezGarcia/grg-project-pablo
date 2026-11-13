import type { UserRole } from "@/generated/prisma/client";

const BILLING_STATISTICS_AND_LIBROS_ROLES = new Set<UserRole>([
  "ADMINISTRADOR",
  "VISITANTE_AVANZADO",
]);

export function canAccessBillingStatisticsAndLibros(role: UserRole): boolean {
  return BILLING_STATISTICS_AND_LIBROS_ROLES.has(role);
}
