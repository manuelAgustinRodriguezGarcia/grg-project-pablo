import { describe, expect, it } from "vitest";
import {
  BILLING_CLIENTS_PATH,
  BILLING_DEBTORS_PATH,
  BILLING_HUB_PATH,
  BILLING_NAV_TABS,
  billingTabCurrentMenuItem,
  billingTabMatchesPath,
} from "@/features/billing/data/billingNav";
import { FileText } from "@/shared/icons";

function tabByHref(href: string) {
  const tab = BILLING_NAV_TABS.find((item) => item.href === href);
  if (!tab) {
    throw new Error(`Missing billing nav tab ${href}`);
  }
  return tab;
}

describe("billing nav tabs", () => {
  const clientsTab = tabByHref(BILLING_CLIENTS_PATH);
  const resumenTab = tabByHref(BILLING_HUB_PATH);

  it("keeps deudores under the Clientes hover menu", () => {
    expect(clientsTab.menuItems?.map((item) => item.label)).toEqual([
      "Lista de clientes",
      "Clientes con deuda",
    ]);
    expect(clientsTab.menuItems?.map((item) => item.href)).toEqual([
      BILLING_CLIENTS_PATH,
      BILLING_DEBTORS_PATH,
    ]);
    expect(clientsTab.menuItems?.map((item) => item.iconTone)).toEqual([
      "blue",
      "red",
    ]);
    expect(clientsTab.menuItems?.[1]?.icon).toBe(FileText);
  });

  it("marks Clientes active on both client and debtor lists", () => {
    expect(billingTabMatchesPath(BILLING_CLIENTS_PATH, clientsTab)).toBe(true);
    expect(billingTabMatchesPath(BILLING_DEBTORS_PATH, clientsTab)).toBe(true);
    expect(billingTabMatchesPath(BILLING_HUB_PATH, clientsTab)).toBe(false);
  });

  it("does not treat nested billing routes as Resumen", () => {
    expect(billingTabMatchesPath(BILLING_CLIENTS_PATH, resumenTab)).toBe(false);
    expect(billingTabMatchesPath(BILLING_DEBTORS_PATH, resumenTab)).toBe(false);
  });

  it("resolves the current submenu item from the path", () => {
    expect(
      billingTabCurrentMenuItem(BILLING_CLIENTS_PATH, clientsTab)?.label,
    ).toBe("Lista de clientes");
    expect(
      billingTabCurrentMenuItem(BILLING_DEBTORS_PATH, clientsTab)?.label,
    ).toBe("Clientes con deuda");
  });
});
