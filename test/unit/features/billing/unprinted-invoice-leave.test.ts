import { describe, expect, it } from "vitest";
import {
  BILLING_CLIENTS_PATH,
  BILLING_DEBTORS_PATH,
  BILLING_HUB_PATH,
  BILLING_INVOICES_PATH,
} from "@/features/billing/data/billingNav";
import { resolveUnprintedLeaveAction } from "@/features/billing/utils/unprinted-invoice-leave";

describe("resolveUnprintedLeaveAction", () => {
  it("para reset usa Crear nueva con F2", () => {
    expect(resolveUnprintedLeaveAction({ type: "reset" })).toEqual({
      label: "Crear nueva",
      shortcut: "F2",
    });
  });

  it("para lista de facturas usa Ir a facturas con L", () => {
    expect(
      resolveUnprintedLeaveAction({
        type: "navigate",
        href: BILLING_INVOICES_PATH,
      }),
    ).toEqual({
      label: "Ir a facturas",
      shortcut: "L",
    });
  });

  it("para deudores usa Ir a Deudores", () => {
    expect(
      resolveUnprintedLeaveAction({
        type: "navigate",
        href: BILLING_DEBTORS_PATH,
      }),
    ).toEqual({
      label: "Ir a Deudores",
    });
  });

  it("para deudores con query o slash final sigue diciendo Ir a Deudores", () => {
    expect(
      resolveUnprintedLeaveAction({
        type: "navigate",
        href: `${BILLING_DEBTORS_PATH}/`,
      }),
    ).toEqual({
      label: "Ir a Deudores",
    });
    expect(
      resolveUnprintedLeaveAction({
        type: "navigate",
        href: `${BILLING_DEBTORS_PATH}?x=1`,
      }),
    ).toEqual({
      label: "Ir a Deudores",
    });
  });

  it("para otras secciones usa Ir a {label}", () => {
    expect(
      resolveUnprintedLeaveAction({
        type: "navigate",
        href: BILLING_CLIENTS_PATH,
      }),
    ).toEqual({
      label: "Ir a Clientes",
    });
  });

  it("para el hub usa Ir al inicio", () => {
    expect(
      resolveUnprintedLeaveAction({
        type: "navigate",
        href: BILLING_HUB_PATH,
      }),
    ).toEqual({
      label: "Ir al inicio",
    });
  });
});
