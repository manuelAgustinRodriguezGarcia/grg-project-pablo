import { describe, expect, it } from "vitest";
import {
  BILLING_GUIDE_CATEGORIES,
  canAccessBillingGuideEntry,
  filterBillingGuideCategories,
} from "@/features/billing/data/billingGuide";

function categoryById(id: string) {
  const category = BILLING_GUIDE_CATEGORIES.find((item) => item.id === id);
  if (!category) {
    throw new Error(`Missing billing guide category ${id}`);
  }
  return category;
}

describe("billing guide data", () => {
  it("keeps the home topics ready for later content", () => {
    expect(BILLING_GUIDE_CATEGORIES.map((item) => item.id)).toEqual([
      "new-invoice",
      "clients",
      "rubros",
      "invoices",
      "movements",
      "notes",
      "libro-iva",
      "search",
      "print",
      "settings",
    ]);
  });

  it("loads only the first navigation articles", () => {
    expect(categoryById("new-invoice").articles.map((item) => item.title)).toEqual([
      "¿Cómo creo una nueva factura?",
    ]);
    expect(categoryById("clients").articles.map((item) => item.title)).toEqual([
      "¿Dónde cargo un nuevo cliente?",
    ]);
    expect(categoryById("rubros").articles.map((item) => item.title)).toEqual([
      "¿Cómo creo un nuevo rubro?",
    ]);
    expect(categoryById("invoices").articles.map((item) => item.title)).toEqual([
      "¿Cómo busco una factura?",
      "¿Cómo imprimo una factura?",
    ]);
  });
});

describe("billing guide permissions", () => {
  it("treats a missing permission as visible", () => {
    expect(canAccessBillingGuideEntry("VENDEDOR")).toBe(true);
  });

  it("hides write articles the role cannot use", () => {
    const visible = filterBillingGuideCategories("VISITANTE_AVANZADO");
    const rubros = visible.find((item) => item.id === "rubros");

    expect(rubros).toBeDefined();
    expect(rubros?.articles).toEqual([]);
    expect(
      visible
        .find((item) => item.id === "new-invoice")
        ?.articles.map((item) => item.id),
    ).toEqual(["how-create-invoice"]);
  });

  it("keeps create-rubro only for roles that can update categories", () => {
    const adminRubros = filterBillingGuideCategories("ADMINISTRADOR").find(
      (item) => item.id === "rubros",
    );
    const seller = filterBillingGuideCategories("VENDEDOR");

    expect(adminRubros?.articles.map((item) => item.id)).toEqual([
      "how-create-rubro",
    ]);
    expect(seller.some((item) => item.id === "rubros")).toBe(false);
    expect(seller.some((item) => item.id === "settings")).toBe(false);
  });
});
