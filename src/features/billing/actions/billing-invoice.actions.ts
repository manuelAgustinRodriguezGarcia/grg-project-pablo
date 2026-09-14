"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { billingFiscalSettingsService } from "@/server/services/billing-fiscal-settings.service";
import { billingInvoiceService } from "@/server/services/billing-invoice.service";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { createBillingInvoiceSchema } from "@/features/billing/schemas/billing-invoice.schemas";
import type {
  BillingFiscalContext,
  BillingInvoiceActionResult,
  BillingInvoiceListItem,
} from "@/features/billing/types/billing-invoice.types";
import { toBillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";

function toActionError(error: unknown): BillingInvoiceActionResult<never> {
  if (error instanceof BillingInvoiceError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  console.error("[billingInvoiceAction]", error);

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function getBillingFiscalContextAction(): Promise<
  BillingInvoiceActionResult<BillingFiscalContext>
> {
  try {
    const settings = await billingFiscalSettingsService.getSettings();
    return {
      success: true,
      data: {
        ivaPercent: settings.ivaPercent.toNumber(),
        genericClientLimit: settings.genericClientLimit.toNumber(),
        pointOfSale: settings.pointOfSale,
        environment: settings.environment,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createBillingInvoiceAction(
  input: unknown,
): Promise<BillingInvoiceActionResult<BillingInvoiceListItem>> {
  const parsed = createBillingInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const invoice = await billingInvoiceService.createInvoice(parsed.data);
    revalidatePath("/admin/facturacion/facturas");
    revalidatePath("/admin/facturacion/comprobantes");
    revalidatePath("/admin/facturacion");
    return { success: true, data: toBillingInvoiceListItem(invoice) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listBillingInvoicesAction(): Promise<
  BillingInvoiceActionResult<BillingInvoiceListItem[]>
> {
  try {
    const invoices = await billingInvoiceService.listInvoices();
    return { success: true, data: invoices.map(toBillingInvoiceListItem) };
  } catch (error) {
    return toActionError(error);
  }
}
