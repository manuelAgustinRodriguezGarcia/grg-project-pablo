import { describe, expect, it } from "vitest";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import {
  buildClientHistoryIdSet,
  findClientFormMatches,
  formatClientFormMatchLine,
  hasExactIdentificationDuplicate,
} from "@/features/billing/utils/client-form-matches";

function client(
  overrides: Partial<BillingClientListItem> = {},
): BillingClientListItem {
  return {
    id: "c1",
    code: "JP-00001",
    name: "JUAN PEREZ",
    address: null,
    city: null,
    province: null,
    email: "juan@correo.com",
    whatsapp: "3492123456",
    identificationType: "CUIT",
    identificationNumber: "20123456786",
    ivaCondition: "RESPONSABLE_INSCRIPTO",
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("client-form-matches", () => {
  const clients = [
    client(),
    client({
      id: "c2",
      code: "MP-00002",
      name: "MARIA PEREZ",
      email: "maria@correo.com",
      whatsapp: "3492987654",
      identificationType: "DNI",
      identificationNumber: "30111222",
      ivaCondition: "CONSUMIDOR_FINAL",
    }),
  ];

  it("formatea la línea informativa de coincidencia", () => {
    expect(formatClientFormMatchLine(clients[0])).toBe(
      "JUAN PEREZ — CUIT 20-12345678-6",
    );
    expect(formatClientFormMatchLine(clients[1])).toBe(
      "MARIA PEREZ — DNI 30.111.222",
    );
  });

  it("encuentra coincidencias por nombre, email, whatsapp e identificación", () => {
    expect(
      findClientFormMatches(clients, "name", "juan").map((row) => row.id),
    ).toEqual(["c1"]);
    expect(
      findClientFormMatches(clients, "email", "maria@").map((row) => row.id),
    ).toEqual(["c2"]);
    expect(
      findClientFormMatches(clients, "whatsapp", "34921").map((row) => row.id),
    ).toEqual(["c1"]);
    expect(
      findClientFormMatches(clients, "identification", "20-123", {
        identificationType: "CUIT",
      }).map((row) => row.id),
    ).toEqual(["c1"]);
  });

  it("detecta CUIT/DNI duplicado exacto", () => {
    expect(
      hasExactIdentificationDuplicate(clients, "CUIT", "20-12345678-6"),
    ).toBe(true);
    expect(
      hasExactIdentificationDuplicate(clients, "DNI", "30111222"),
    ).toBe(true);
    expect(
      hasExactIdentificationDuplicate(clients, "CUIT", "30710182175"),
    ).toBe(false);
  });

  it("arma el set de clientes con historial desde facturas, recibos y notas", () => {
    const history = buildClientHistoryIdSet(
      [{ clientId: "c1" }, { clientId: null }],
      [{ clientId: "c2" }],
      [{ clientId: "c3" }, { clientId: null }],
    );

    expect([...history].sort()).toEqual(["c1", "c2", "c3"]);
  });
});
