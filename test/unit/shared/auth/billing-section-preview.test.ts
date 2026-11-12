import { describe, expect, it } from "vitest";
import { canPreviewBillingSections } from "@/shared/auth/billing-section-preview";

describe("vista previa de estadísticas y libros de IVA", () => {
  it("acepta solo las dos cuentas habilitadas", () => {
    expect(canPreviewBillingSections("agencygrg@gmail.com")).toBe(true);
    expect(canPreviewBillingSections("visitagrg@gmail.com")).toBe(true);
    expect(canPreviewBillingSections(" AgencyGRG@gmail.com ")).toBe(true);
    expect(canPreviewBillingSections("otro@rothamel.com")).toBe(false);
    expect(canPreviewBillingSections(null)).toBe(false);
    expect(canPreviewBillingSections(undefined)).toBe(false);
  });
});
