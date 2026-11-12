import { describe, expect, it } from "vitest";
import {
  changeSelectionYear,
  createMonthSelection,
  isFullYearSelection,
  toggleFullYear,
  toggleSelectedMonth,
} from "@/features/billing/utils/billing-statistics-selection";

describe("multiselección de meses", () => {
  it("empieza en el mes actual y permite cualquier combinación", () => {
    const initial = createMonthSelection(2026, 11);
    expect(initial).toEqual({ year: 2026, months: [11] });

    const cleared = toggleSelectedMonth(initial, 11);
    expect(cleared.months).toEqual([]);

    const two = toggleSelectedMonth(toggleSelectedMonth(cleared, 1), 3);
    expect(two.months).toEqual([1, 3]);

    let five = cleared;
    for (const month of [1, 2, 3, 4, 5]) {
      five = toggleSelectedMonth(five, month);
    }
    expect(five.months).toEqual([1, 2, 3, 4, 5]);

    let eleven = createMonthSelection(2026, 1);
    for (let month = 2; month <= 11; month += 1) {
      eleven = toggleSelectedMonth(eleven, month);
    }
    expect(eleven.months).toHaveLength(11);
    expect(isFullYearSelection(eleven.months)).toBe(false);
  });

  it("activa y desactiva el año completo según los doce meses", () => {
    const full = toggleFullYear(createMonthSelection(2026, 11));
    expect(full.months).toHaveLength(12);
    expect(isFullYearSelection(full.months)).toBe(true);

    const eleven = toggleSelectedMonth(full, 4);
    expect(eleven.months).toHaveLength(11);
    expect(isFullYearSelection(eleven.months)).toBe(false);

    const restored = toggleSelectedMonth(eleven, 4);
    expect(isFullYearSelection(restored.months)).toBe(true);

    expect(toggleFullYear(restored).months).toEqual([]);
  });

  it("cambia de año y conserva los meses elegidos", () => {
    const next = changeSelectionYear(
      toggleSelectedMonth(createMonthSelection(2026, 10), 11),
      2025,
    );
    expect(next).toEqual({ year: 2025, months: [10, 11] });
  });
});
