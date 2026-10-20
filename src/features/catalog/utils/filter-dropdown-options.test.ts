import { describe, expect, it } from "vitest";
import { filterOptionsByLabel } from "@/features/catalog/utils/filter-dropdown-options";

const options = [
  { id: "1", label: "LISTA GENERAL" },
  { id: "2", label: "LISTA MAYORISTA" },
  { id: "3", label: "LISTA MINORISTA" },
  { id: "4", label: "LISTA CLIENTES ESPECIALES" },
  { id: "5", label: "LISTA DISTRIBUIDORES" },
];

describe("filterOptionsByLabel", () => {
  it("filtra por nombre sin distinguir mayúsculas y conserva el orden", () => {
    expect(filterOptionsByLabel(options, "may").map((option) => option.id)).toEqual(["2"]);
    expect(filterOptionsByLabel(options, "CLIENTES").map((option) => option.id)).toEqual(["4"]);
    expect(filterOptionsByLabel(options, "lista").map((option) => option.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("devuelve la lista completa cuando la búsqueda está vacía", () => {
    expect(filterOptionsByLabel(options, "   ")).toEqual(options);
  });
});
