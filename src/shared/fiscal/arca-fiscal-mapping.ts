import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteKind,
} from "@/generated/prisma/client";

export const UNSUPPORTED_ARCA_VAT_CONDITION = "UNSUPPORTED_ARCA_VAT_CONDITION";

export class UnsupportedArcaVatConditionError extends Error {
  readonly code = UNSUPPORTED_ARCA_VAT_CONDITION;

  constructor() {
    super("La condición de IVA no tiene un mapeo vigente para ARCA.");
    this.name = "UnsupportedArcaVatConditionError";
  }
}

export const ARCA_DOCUMENT_TYPE = {
  CUIT: 80,
  DNI: 96,
  NINGUNO: 99,
} as const;

/** Productos. No incluye fechas de servicio. */
export const ARCA_CONCEPT_PRODUCTS = 1;

export const ARCA_CURRENCY_ID = "PES";
export const ARCA_CURRENCY_RATE = 1;

/** Id de alícuota. No es CondicionIVAReceptorId. */
export const ARCA_VAT_RATE_ID = {
  21: 5,
} as const;

export function arcaVatRateId(percent: number): number | null {
  if (percent === 21) {
    return ARCA_VAT_RATE_ID[21];
  }

  return null;
}

export const ARCA_VOUCHER_TYPE = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
} as const;

type ArcaVatRule = {
  receptorVatConditionId: number;
  voucherClass: BillingInvoiceType;
};

const ARCA_VAT_RULES = {
  RESPONSABLE_INSCRIPTO: { receptorVatConditionId: 1, voucherClass: "A" },
  MONOTRIBUTISTA: { receptorVatConditionId: 6, voucherClass: "A" },
  EXENTO: { receptorVatConditionId: 4, voucherClass: "B" },
  CONSUMIDOR_FINAL: { receptorVatConditionId: 5, voucherClass: "B" },
} as const satisfies Partial<Record<BillingIvaCondition, ArcaVatRule>>;

export type ArcaFiscalProfile = {
  receptorVatConditionId: number;
  voucherClass: BillingInvoiceType;
  voucherType: number;
  documentType: number;
  documentNumber: number | null;
};

function vatRule(condition: BillingIvaCondition): ArcaVatRule {
  switch (condition) {
    case "RESPONSABLE_INSCRIPTO":
    case "MONOTRIBUTISTA":
    case "EXENTO":
    case "CONSUMIDOR_FINAL":
      return ARCA_VAT_RULES[condition];
    case "RESPONSABLE_NO_INSCRIPTO":
      throw new UnsupportedArcaVatConditionError();
    default: {
      const unexpected: never = condition;
      throw unexpected;
    }
  }
}

function documentTypeFor(
  identificationType: BillingIdentificationType,
): Pick<ArcaFiscalProfile, "documentType" | "documentNumber"> {
  switch (identificationType) {
    case "CUIT":
      return { documentType: ARCA_DOCUMENT_TYPE.CUIT, documentNumber: null };
    case "DNI":
      return { documentType: ARCA_DOCUMENT_TYPE.DNI, documentNumber: null };
    case "NINGUNO":
      return {
        documentType: ARCA_DOCUMENT_TYPE.NINGUNO,
        documentNumber: 0,
      };
    default: {
      const unexpected: never = identificationType;
      throw unexpected;
    }
  }
}

export function voucherTypeForClass(voucherClass: BillingInvoiceType): number {
  switch (voucherClass) {
    case "A":
      return ARCA_VOUCHER_TYPE.FACTURA_A;
    case "B":
      return ARCA_VOUCHER_TYPE.FACTURA_B;
    default: {
      const unexpected: never = voucherClass;
      return unexpected;
    }
  }
}

export function voucherTypeForBillingNote(
  kind: BillingNoteKind,
  invoiceType: BillingInvoiceType,
): number {
  switch (invoiceType) {
    case "A":
      switch (kind) {
        case "DEBIT":
          return ARCA_VOUCHER_TYPE.NOTA_DEBITO_A;
        case "CREDIT":
          return ARCA_VOUCHER_TYPE.NOTA_CREDITO_A;
        default: {
          const unexpected: never = kind;
          return unexpected;
        }
      }
    case "B":
      switch (kind) {
        case "DEBIT":
          return ARCA_VOUCHER_TYPE.NOTA_DEBITO_B;
        case "CREDIT":
          return ARCA_VOUCHER_TYPE.NOTA_CREDITO_B;
        default: {
          const unexpected: never = kind;
          return unexpected;
        }
      }
    default: {
      const unexpected: never = invoiceType;
      return unexpected;
    }
  }
}

/**
 * Perfil ARCA vigente para un receptor.
 * Responsable No Inscripto no tiene CondicionIVAReceptorId y no se puede emitir.
 * documentNumber null significa que el número lo aporta el cliente (CUIT o DNI).
 */
export function resolveArcaFiscalProfile(
  identificationType: BillingIdentificationType,
  ivaCondition: BillingIvaCondition,
): ArcaFiscalProfile {
  const rule = vatRule(ivaCondition);
  const document = documentTypeFor(identificationType);

  return {
    receptorVatConditionId: rule.receptorVatConditionId,
    voucherClass: rule.voucherClass,
    voucherType: voucherTypeForClass(rule.voucherClass),
    documentType: document.documentType,
    documentNumber: document.documentNumber,
  };
}
