import type {
  BillingClient,
  BillingIdentificationType,
  BillingIvaCondition,
} from "@/generated/prisma/client";

export type BillingClientActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type BillingClientListItem = Pick<
  BillingClient,
  | "id"
  | "code"
  | "name"
  | "address"
  | "city"
  | "province"
  | "email"
  | "whatsapp"
  | "identificationType"
  | "identificationNumber"
  | "ivaCondition"
  | "notes"
  | "createdAt"
>;

export const IDENTIFICATION_TYPE_LABELS: Record<BillingIdentificationType, string> =
  {
    CUIT: "CUIT",
    DNI: "DNI",
    NINGUNO: "Sin documento",
  };

export const IVA_CONDITION_SHORT_LABELS: Record<BillingIvaCondition, string> = {
  RESPONSABLE_INSCRIPTO: "R.I",
  RESPONSABLE_NO_INSCRIPTO: "R.N.I",
  MONOTRIBUTISTA: "M",
  CONSUMIDOR_FINAL: "C.F",
  EXENTO: "E",
};

export const IVA_CONDITION_LABELS: Record<BillingIvaCondition, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable Inscripto",
  RESPONSABLE_NO_INSCRIPTO: "Responsable No Inscripto",
  MONOTRIBUTISTA: "Monotributista",
  CONSUMIDOR_FINAL: "Consumidor Final",
  EXENTO: "Exento",
};

export const IVA_CONDITION_ORDER: readonly BillingIvaCondition[] = [
  "RESPONSABLE_INSCRIPTO",
  "RESPONSABLE_NO_INSCRIPTO",
  "MONOTRIBUTISTA",
  "CONSUMIDOR_FINAL",
  "EXENTO",
];

export function toBillingClientListItem(
  client: BillingClient,
): BillingClientListItem {
  return {
    id: client.id,
    code: client.code,
    name: client.name,
    address: client.address,
    city: client.city,
    province: client.province,
    email: client.email,
    whatsapp: client.whatsapp,
    identificationType: client.identificationType,
    identificationNumber: client.identificationNumber,
    ivaCondition: client.ivaCondition,
    notes: client.notes,
    createdAt: client.createdAt,
  };
}
