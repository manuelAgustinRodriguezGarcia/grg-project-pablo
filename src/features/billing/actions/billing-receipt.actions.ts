"use server";

import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { billingInvoiceService } from "@/server/services/billing-invoice.service";
import { billingReceiptService } from "@/server/services/billing-receipt.service";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  allocateBillingReceiptSchema,
  createBillingReceiptSchema,
} from "@/features/billing/schemas/billing-receipt.schemas";
import type { BillingReceiptActionResult } from "@/features/billing/types/billing-receipt.types";
import {
  toBillingReceiptListItem,
  type BillingReceiptListItem,
} from "@/features/billing/types/billing-receipt.types";

function toActionError(error: unknown): BillingReceiptActionResult<never> {
  if (error instanceof BillingInvoiceError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  console.error("[billingReceiptAction]", error);

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function listBillingReceiptsAction(): Promise<
  BillingReceiptActionResult<BillingReceiptListItem[]>
> {
  try {
    const receipts = await billingReceiptService.listReceipts();
    return { success: true, data: receipts.map(toBillingReceiptListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function releaseClientOverpaymentsAction(
  clientId: string,
): Promise<BillingReceiptActionResult<BillingReceiptListItem[]>> {
  try {
    await billingInvoiceService.releaseClientOverpayments(clientId);
    const receipts = await billingReceiptService.listReceipts();
    return { success: true, data: receipts.map(toBillingReceiptListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createBillingReceiptAction(
  input: unknown,
): Promise<BillingReceiptActionResult<BillingReceiptListItem>> {
  const parsed = createBillingReceiptSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const receipt = await billingReceiptService.createReceipt(parsed.data);
    return { success: true, data: toBillingReceiptListItem(receipt) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function allocateBillingReceiptAction(
  input: unknown,
): Promise<BillingReceiptActionResult<BillingReceiptListItem>> {
  const parsed = allocateBillingReceiptSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const receipt = await billingReceiptService.allocateReceipt(parsed.data);
    return { success: true, data: toBillingReceiptListItem(receipt) };
  } catch (error) {
    return toActionError(error);
  }
}
