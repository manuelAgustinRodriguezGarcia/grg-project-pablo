import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildParticipationChart,
  statisticsAmountNumber,
} from "@/features/billing/utils/billing-statistics-display";
import { getBlueScaleColorsByAmount } from "@/features/billing/utils/dashboard-chart-colors";
import { StatisticsBreakdown, type StatisticsRankItem } from "./StatisticsBreakdown";

function rankItem(name: string, total: string): StatisticsRankItem {
  return {
    key: name,
    rank: 1,
    name,
    code: "",
    historical: false,
    total,
    sharePercent: null,
    shareUnavailableReason: null,
    secondary: "",
  };
}

const ITEMS = [
  rankItem("Metalurgica", "100.00"),
  rankItem("Rodamientos", "90.00"),
  rankItem("Filtros", "80.00"),
  rankItem("Frenos", "40.00"),
  rankItem("Tractores", "30.00"),
  rankItem("Catalogo", "20.00"),
  rankItem("Chico A", "35.00"),
  rankItem("Chico B", "25.00"),
];

afterEach(() => {
  cleanup();
});

describe("StatisticsBreakdown", () => {
  it("muestra a la izquierda de cada rubro el color de su porción", () => {
    const participation = buildParticipationChart({
      rows: ITEMS.map((item) => ({ key: item.key, label: item.name, total: item.total })),
      totalGroups: ITEMS.length,
      othersLabel: "Otros rubros",
    });
    expect(participation.status).toBe("ready");
    if (participation.status !== "ready") {
      return;
    }

    const colors = getBlueScaleColorsByAmount(
      participation.slices.map((slice) => ({
        amount: statisticsAmountNumber(slice.total),
      })),
    );

    render(
      <StatisticsBreakdown
        noun="rubros"
        items={ITEMS}
        totalGroups={ITEMS.length}
        selectedKey={null}
        onSelect={() => undefined}
        expanded={false}
        onToggleExpanded={() => undefined}
        entity={null}
        context={null}
      />,
    );

    const legend = screen.getByTestId("participation-legend");
    const rows = [...legend.querySelectorAll("li")];
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, " ").trim())).toEqual(
      participation.slices.map((slice) => expect.stringContaining(slice.label)),
    );

    const swatches = screen.getAllByTestId("participation-swatch");
    expect(swatches).toHaveLength(colors.length);
    swatches.forEach((swatch, index) => {
      expect(swatch).toHaveStyle({ backgroundColor: colors[index] });
    });

    const othersIndex = participation.slices.findIndex((slice) => slice.key === "others");
    const catalogoIndex = participation.slices.findIndex((slice) => slice.label === "Catalogo");
    expect(colors[othersIndex]).not.toBe(colors[catalogoIndex]);
  });
});
