import { describe, expect, it } from "vitest";
import type { BillingClientPickerItem } from "@/features/billing/utils/billing-client-picker";
import {
  filterBillingClientsForPicker,
  formatBillingClientPickerIdentification,
  toBillingClientPickerOptions,
} from "@/features/billing/utils/billing-client-picker";

function client(
  overrides: Partial<BillingClientPickerItem> = {},
): BillingClientPickerItem {
  return {
    id: "c1",
    code: "C-001",
    name: "José Ñandú",
    identificationType: "CUIT",
    identificationNumber: "20123456789",
    ivaCondition: "RESPONSABLE_INSCRIPTO",
    ...overrides,
  };
}

describe("filterBillingClientsForPicker", () => {
  const clients = [
    client(),
    client({
      id: "c2",
      code: "C-002",
      name: "Maria Perez",
      identificationType: "DNI",
      identificationNumber: "30111222",
      ivaCondition: "CONSUMIDOR_FINAL",
    }),
  ];

  it("filtra por nombre, código o CUIT/DNI", () => {
    expect(filterBillingClientsForPicker(clients, "josé").map((row) => row.id)).toEqual([
      "c1",
    ]);
    expect(filterBillingClientsForPicker(clients, "c-002").map((row) => row.id)).toEqual([
      "c2",
    ]);
    expect(
      filterBillingClientsForPicker(clients, "20-12345678-9").map((row) => row.id),
    ).toEqual(["c1"]);
    expect(filterBillingClientsForPicker(clients, "30111222").map((row) => row.id)).toEqual([
      "c2",
    ]);
  });
});

describe("toBillingClientPickerOptions", () => {
  it("arma título, documento y letra", () => {
    expect(toBillingClientPickerOptions([client()], "")).toEqual([
      {
        id: "c1",
        title: "José Ñandú",
        subtitle: `C-001 · ${formatBillingClientPickerIdentification(client())}`,
        badge: "A",
      },
    ]);
  });
});
