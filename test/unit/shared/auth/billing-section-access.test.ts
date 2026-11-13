import { describe, expect, it } from "vitest";
import { canAccessBillingStatisticsAndLibros } from "@/shared/auth/billing-section-access";

describe("acceso a estadísticas y libros de IVA", () => {
  it("acepta a todos los administradores y visitantes avanzados", () => {
    expect(canAccessBillingStatisticsAndLibros("ADMINISTRADOR")).toBe(true);
    expect(canAccessBillingStatisticsAndLibros("VISITANTE_AVANZADO")).toBe(true);
    expect(canAccessBillingStatisticsAndLibros("VENDEDOR")).toBe(false);
    expect(canAccessBillingStatisticsAndLibros("VISITANTE")).toBe(false);
  });
});
