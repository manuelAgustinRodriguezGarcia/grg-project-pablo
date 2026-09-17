import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import { determineInvoiceType } from "@/shared/utils/billing-invoice-rules";
import {
  formatCuit,
  formatDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";

export const BILLING_CLIENT_PICKER_LIMIT = 50;

export type BillingClientPickerItem = Pick<
  BillingClientListItem,
  | "id"
  | "code"
  | "name"
  | "identificationType"
  | "identificationNumber"
  | "ivaCondition"
>;

export function formatBillingClientPickerIdentification(
  client: Pick<
    BillingClientPickerItem,
    "identificationType" | "identificationNumber"
  >,
): string {
  if (client.identificationType === "CUIT" && client.identificationNumber) {
    return `CUIT ${formatCuit(client.identificationNumber)}`;
  }

  if (client.identificationType === "DNI" && client.identificationNumber) {
    return `DNI ${formatDni(client.identificationNumber)}`;
  }

  return "Sin documento";
}

export function filterBillingClientsForPicker<T extends BillingClientPickerItem>(
  clients: T[],
  query: string,
  limit = BILLING_CLIENT_PICKER_LIMIT,
): T[] {
  const normalized = query.trim().toLocaleLowerCase("es-AR");
  const queryDigits = normalizeIdentificationDigits(normalized);

  const matches = clients.filter((client) => {
    if (!normalized) {
      return true;
    }

    const matchesText =
      client.name.toLocaleLowerCase("es-AR").includes(normalized) ||
      client.code.toLocaleLowerCase("es-AR").includes(normalized);

    const matchesIdentification =
      queryDigits.length > 0 &&
      client.identificationNumber !== null &&
      client.identificationNumber.includes(queryDigits);

    return matchesText || matchesIdentification;
  });

  return matches.slice(0, limit);
}

export function toBillingClientPickerOptions(
  clients: BillingClientPickerItem[],
  query: string,
) {
  return filterBillingClientsForPicker(clients, query).map((client) => ({
    id: client.id,
    title: client.name,
    subtitle: `${client.code} · ${formatBillingClientPickerIdentification(client)}`,
    badge: determineInvoiceType(
      client.identificationType,
      client.ivaCondition,
    ),
  }));
}
