import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import { formatBillingClientPickerIdentification } from "@/features/billing/utils/billing-client-picker";
import { normalizeIdentificationDigits } from "@/shared/utils/identification";

export const CLIENT_FORM_MATCH_LIMIT = 6;

export type ClientFormMatchField =
  | "name"
  | "email"
  | "whatsapp"
  | "identification";

export function formatClientFormMatchLine(
  client: Pick<
    BillingClientListItem,
    "name" | "identificationType" | "identificationNumber"
  >,
): string {
  return `${client.name} — ${formatBillingClientPickerIdentification(client)}`;
}

export function findClientFormMatches(
  clients: BillingClientListItem[],
  field: ClientFormMatchField,
  rawValue: string,
  options?: {
    excludeId?: string | null;
    identificationType?: BillingClientListItem["identificationType"];
    limit?: number;
  },
): BillingClientListItem[] {
  const limit = options?.limit ?? CLIENT_FORM_MATCH_LIMIT;
  const excludeId = options?.excludeId ?? null;
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return [];
  }

  const matches = clients.filter((client) => {
    if (excludeId && client.id === excludeId) {
      return false;
    }

    switch (field) {
      case "name": {
        const query = trimmed.toLocaleLowerCase("es-AR");
        if (query.length < 2) {
          return false;
        }
        return client.name.toLocaleLowerCase("es-AR").includes(query);
      }
      case "email": {
        if (!client.email || trimmed.length < 3) {
          return false;
        }
        return client.email
          .toLocaleLowerCase("es-AR")
          .includes(trimmed.toLocaleLowerCase("es-AR"));
      }
      case "whatsapp": {
        const queryDigits = normalizeIdentificationDigits(trimmed);
        if (queryDigits.length < 4 || !client.whatsapp) {
          return false;
        }
        return normalizeIdentificationDigits(client.whatsapp).includes(
          queryDigits,
        );
      }
      case "identification": {
        const queryDigits = normalizeIdentificationDigits(trimmed);
        if (queryDigits.length < 3 || !client.identificationNumber) {
          return false;
        }
        if (
          options?.identificationType &&
          options.identificationType !== "NINGUNO" &&
          client.identificationType !== options.identificationType
        ) {
          return false;
        }
        return client.identificationNumber.includes(queryDigits);
      }
      default: {
        const _exhaustive: never = field;
        return _exhaustive;
      }
    }
  });

  return matches.slice(0, limit);
}

export function hasExactIdentificationDuplicate(
  clients: BillingClientListItem[],
  identificationType: BillingClientListItem["identificationType"],
  identificationNumber: string,
  excludeId?: string | null,
): boolean {
  if (identificationType !== "CUIT" && identificationType !== "DNI") {
    return false;
  }

  const digits = normalizeIdentificationDigits(identificationNumber);
  if (!digits) {
    return false;
  }

  return clients.some(
    (client) =>
      client.id !== excludeId &&
      client.identificationType === identificationType &&
      client.identificationNumber === digits,
  );
}

export function buildClientHistoryIdSet(
  invoices: Array<{ clientId: string | null }>,
  receipts: Array<{ clientId: string }>,
  notes: Array<{ clientId: string | null }>,
): Set<string> {
  const ids = new Set<string>();

  for (const invoice of invoices) {
    if (invoice.clientId) {
      ids.add(invoice.clientId);
    }
  }

  for (const receipt of receipts) {
    ids.add(receipt.clientId);
  }

  for (const note of notes) {
    if (note.clientId) {
      ids.add(note.clientId);
    }
  }

  return ids;
}
