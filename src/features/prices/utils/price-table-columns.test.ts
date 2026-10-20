import { describe, expect, it } from "vitest";
import { sortPriceColumnsByConfiguredOrder } from "@/features/prices/utils/price-table-columns";

const columns = [
  { id: "code", displayName: "Código" },
  { id: "price", displayName: "Precio" },
  { id: "data", displayName: "Datos" },
];

describe("sortPriceColumnsByConfiguredOrder", () => {
  it("aplica el mismo orden configurado para administrador y usuario", () => {
    const orderById = new Map([
      ["price", 0],
      ["data", 1],
      ["code", 2],
    ]);

    const adminColumns = sortPriceColumnsByConfiguredOrder(columns, orderById);
    const userColumns = sortPriceColumnsByConfiguredOrder(
      columns.filter((column) => column.id !== "price"),
      orderById,
    );

    expect(adminColumns.map((column) => column.id)).toEqual(["price", "data", "code"]);
    expect(userColumns.map((column) => column.id)).toEqual(["data", "code"]);
  });

  it("desempata por nombre cuando el orden guardado es el mismo", () => {
    const orderById = new Map([
      ["code", 0],
      ["price", 0],
      ["data", 0],
    ]);

    expect(
      sortPriceColumnsByConfiguredOrder(columns, orderById).map((column) => column.id),
    ).toEqual(["code", "data", "price"]);
  });
});
