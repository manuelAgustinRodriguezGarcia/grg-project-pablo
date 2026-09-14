"use server";

import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { billingClientService } from "@/server/services/billing-client.service";
import { BillingClientError } from "@/server/services/billing-client.errors";
import {
  billingClientIdSchema,
  createBillingClientSchema,
  updateBillingClientSchema,
} from "@/features/billing/schemas/billing-client.schemas";
import type {
  BillingClientActionResult,
  BillingClientListItem,
} from "@/features/billing/types/billing-client.types";
import { toBillingClientListItem } from "@/features/billing/types/billing-client.types";

function toActionError(error: unknown): BillingClientActionResult<never> {
  if (error instanceof BillingClientError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function listBillingClientsAction(): Promise<
  BillingClientActionResult<BillingClientListItem[]>
> {
  try {
    const clients = await billingClientService.listClients();
    return { success: true, data: clients.map(toBillingClientListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function ensureGenericBillingClientAction(): Promise<
  BillingClientActionResult<BillingClientListItem>
> {
  try {
    const client = await billingClientService.ensureGenericClient();
    return { success: true, data: toBillingClientListItem(client) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createBillingClientAction(
  input: unknown,
): Promise<BillingClientActionResult<BillingClientListItem>> {
  const parsed = createBillingClientSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const client = await billingClientService.createClient(parsed.data);
    return { success: true, data: toBillingClientListItem(client) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBillingClientAction(
  input: unknown,
): Promise<BillingClientActionResult<BillingClientListItem>> {
  const parsed = updateBillingClientSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const client = await billingClientService.updateClient(parsed.data);
    return { success: true, data: toBillingClientListItem(client) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteBillingClientAction(
  input: unknown,
): Promise<BillingClientActionResult<void>> {
  const parsed = billingClientIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await billingClientService.deleteClient(parsed.data.clientId);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
