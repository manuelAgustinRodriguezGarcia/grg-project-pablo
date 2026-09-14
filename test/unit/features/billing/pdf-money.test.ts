import { describe, expect, it } from "vitest";
import {
  formatPdfAmount,
  formatPdfQuantity,
} from "@/features/billing/utils/pdf-money";

describe("formatPdfAmount", () => {
  it("usa punto para los miles", () => {
    expect(formatPdfAmount(10_000_000)).toBe("10.000.000,00");
    expect(formatPdfAmount(1210.5)).toBe("1.210,50");
  });
});

describe("formatPdfQuantity", () => {
  it("omite decimales innecesarios", () => {
    expect(formatPdfQuantity(2)).toBe("2");
    expect(formatPdfQuantity(2.5)).toBe("2,5");
  });
});
