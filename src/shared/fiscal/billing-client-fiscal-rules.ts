import type {
  BillingIdentificationType,
  BillingIvaCondition,
} from "@/generated/prisma/client";

export const IVA_CONDITION_REQUIRES_CUIT_MESSAGE = {
  RESPONSABLE_INSCRIPTO: "Responsable Inscripto requiere CUIT.",
  MONOTRIBUTISTA: "Monotributista requiere CUIT.",
  EXENTO: "Exento requiere CUIT.",
} as const;

export const LEGACY_RNI_UNAVAILABLE_MESSAGE =
  "Responsable No Inscripto no está disponible para clientes nuevos.";

const CUIT_IVA_CONDITIONS = [
  "RESPONSABLE_INSCRIPTO",
  "MONOTRIBUTISTA",
  "CONSUMIDOR_FINAL",
  "EXENTO",
] as const satisfies readonly BillingIvaCondition[];

export function clientFiscalPairError(input: {
  identificationType: BillingIdentificationType;
  ivaCondition: BillingIvaCondition;
  existingIvaCondition?: BillingIvaCondition | null;
}): string | null {
  const { identificationType, ivaCondition, existingIvaCondition } = input;

  if (ivaCondition === "RESPONSABLE_NO_INSCRIPTO") {
    const keepsLegacy =
      existingIvaCondition === "RESPONSABLE_NO_INSCRIPTO" &&
      identificationType === "CUIT";

    if (keepsLegacy) {
      return null;
    }

    if (
      existingIvaCondition === "RESPONSABLE_NO_INSCRIPTO" &&
      identificationType !== "CUIT"
    ) {
      return "Responsable No Inscripto requiere CUIT.";
    }

    return LEGACY_RNI_UNAVAILABLE_MESSAGE;
  }

  switch (ivaCondition) {
    case "RESPONSABLE_INSCRIPTO":
    case "MONOTRIBUTISTA":
    case "EXENTO":
      return identificationType === "CUIT"
        ? null
        : IVA_CONDITION_REQUIRES_CUIT_MESSAGE[ivaCondition];
    case "CONSUMIDOR_FINAL":
      return null;
    default: {
      const unexpected: never = ivaCondition;
      return unexpected;
    }
  }
}

export function selectableIvaConditions(input: {
  identificationType: BillingIdentificationType;
  currentIvaCondition: BillingIvaCondition;
  initialIvaCondition?: BillingIvaCondition | null;
}): BillingIvaCondition[] {
  if (input.identificationType !== "CUIT") {
    return ["CONSUMIDOR_FINAL"];
  }

  const conditions: BillingIvaCondition[] = [...CUIT_IVA_CONDITIONS];
  const showLegacyRni =
    input.initialIvaCondition === "RESPONSABLE_NO_INSCRIPTO" &&
    input.currentIvaCondition === "RESPONSABLE_NO_INSCRIPTO";

  if (showLegacyRni) {
    conditions.splice(1, 0, "RESPONSABLE_NO_INSCRIPTO");
  }

  return conditions;
}
