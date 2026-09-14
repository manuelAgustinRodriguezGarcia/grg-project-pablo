import type {
  BillingClient,
  BillingIdentificationType,
  BillingIvaCondition,
} from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth";
import {
  billingClientRepository,
  type CreateBillingClientData,
} from "@/server/repositories/billing-client.repository";
import { isArgentineProvince } from "@/shared/utils/argentine-provinces";
import {
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import {
  GENERIC_BILLING_CLIENT_NAME,
  isGenericBillingClient,
} from "@/shared/utils/billing-invoice-rules";
import { buildBillingClientCode, normalizeBillingClientCode } from "./billing-client-code";
import { BillingClientError } from "./billing-client.errors";

const CODE_GENERATION_MAX_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BillingClientInput = {
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  identificationType: BillingIdentificationType;
  identificationNumber?: string | null;
  ivaCondition: BillingIvaCondition;
  notes?: string | null;
};

export type UpdateBillingClientInput = BillingClientInput & {
  id: string;
  code?: string | null;
};

type SanitizedBillingClientInput = {
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  email: string | null;
  whatsapp: string | null;
  identificationType: BillingIdentificationType;
  identificationNumber: string | null;
  ivaCondition: BillingIvaCondition;
  notes: string | null;
};

function sanitizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeProvince(value: string | null | undefined): string | null {
  const trimmed = sanitizeOptionalText(value);

  if (trimmed === null) {
    return null;
  }

  if (!isArgentineProvince(trimmed)) {
    throw new BillingClientError(
      "Seleccione una provincia argentina de la lista.",
      "VALIDATION_ERROR",
    );
  }

  return trimmed;
}

function sanitizeEmail(value: string | null | undefined): string | null {
  const trimmed = sanitizeOptionalText(value);

  if (trimmed === null) {
    return null;
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    throw new BillingClientError(
      "Introduzca un email válido o deje el campo vacío.",
      "VALIDATION_ERROR",
    );
  }

  return trimmed.toLocaleLowerCase("es-AR");
}

function sanitizeWhatsapp(value: string | null | undefined): string | null {
  const trimmed = sanitizeOptionalText(value);

  if (trimmed === null) {
    return null;
  }

  const digits = normalizeIdentificationDigits(trimmed);

  if (digits.length < 6 || digits.length > 15) {
    throw new BillingClientError(
      "Introduzca un número de WhatsApp válido o deje el campo vacío.",
      "VALIDATION_ERROR",
    );
  }

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function sanitizeIdentification(input: BillingClientInput): {
  identificationType: BillingIdentificationType;
  identificationNumber: string | null;
  ivaCondition: BillingIvaCondition;
} {
  if (input.identificationType === "CUIT") {
    const raw = sanitizeOptionalText(input.identificationNumber);

    if (raw === null) {
      throw new BillingClientError(
        "Ingrese el CUIT del cliente.",
        "VALIDATION_ERROR",
      );
    }

    const digits = normalizeIdentificationDigits(raw);

    if (!isValidCuit(digits)) {
      throw new BillingClientError(
        "El CUIT no es válido. Verifique los 11 dígitos.",
        "INVALID_CUIT",
      );
    }

    return {
      identificationType: "CUIT",
      identificationNumber: digits,
      ivaCondition: input.ivaCondition,
    };
  }

  if (input.identificationType === "DNI") {
    const raw = sanitizeOptionalText(input.identificationNumber);

    if (raw === null) {
      throw new BillingClientError(
        "Ingrese el DNI del cliente.",
        "VALIDATION_ERROR",
      );
    }

    const digits = normalizeIdentificationDigits(raw);

    if (!isValidDni(digits)) {
      throw new BillingClientError(
        "El DNI no es válido. Debe tener 7 u 8 dígitos.",
        "INVALID_DNI",
      );
    }

    if (input.ivaCondition !== "CONSUMIDOR_FINAL") {
      throw new BillingClientError(
        "Con DNI solo se admite la condición Consumidor Final.",
        "INVALID_IVA_CONDITION",
      );
    }

    return {
      identificationType: "DNI",
      identificationNumber: digits,
      ivaCondition: "CONSUMIDOR_FINAL",
    };
  }

  if (input.ivaCondition !== "CONSUMIDOR_FINAL") {
    throw new BillingClientError(
      "Sin documento solo se admite la condición Consumidor Final.",
      "INVALID_IVA_CONDITION",
    );
  }

  return {
    identificationType: "NINGUNO",
    identificationNumber: null,
    ivaCondition: "CONSUMIDOR_FINAL",
  };
}

function sanitizeBillingClientInput(
  input: BillingClientInput,
): SanitizedBillingClientInput {
  const name = input.name.trim().toLocaleUpperCase("es-AR");

  if (!name) {
    throw new BillingClientError(
      "El nombre o razón social es obligatorio.",
      "VALIDATION_ERROR",
    );
  }

  const identification = sanitizeIdentification(input);

  return {
    name,
    address: sanitizeOptionalText(input.address),
    city: sanitizeOptionalText(input.city),
    province: sanitizeProvince(input.province),
    email: sanitizeEmail(input.email),
    whatsapp: sanitizeWhatsapp(input.whatsapp),
    notes: sanitizeOptionalText(input.notes),
    ...identification,
  };
}

async function requireBillingClient(id: string): Promise<BillingClient> {
  const client = await billingClientRepository.findById(id);

  if (!client) {
    throw new BillingClientError(
      "Cliente no encontrado.",
      "BILLING_CLIENT_NOT_FOUND",
    );
  }

  return client;
}

async function ensureUniqueIdentification(
  identificationType: BillingIdentificationType,
  identificationNumber: string | null,
  excludeId?: string,
): Promise<void> {
  if (
    identificationNumber === null ||
    (identificationType !== "CUIT" && identificationType !== "DNI")
  ) {
    return;
  }

  const existing = await billingClientRepository.findByIdentification(
    identificationType,
    identificationNumber,
  );

  if (existing && existing.id !== excludeId) {
    if (identificationType === "CUIT") {
      throw new BillingClientError(
        "Ya existe un cliente registrado con este CUIT.",
        "DUPLICATE_CUIT",
      );
    }

    throw new BillingClientError(
      "Ya existe un cliente registrado con este DNI.",
      "DUPLICATE_DNI",
    );
  }
}

async function ensureUniqueClientCode(
  code: string,
  excludeId?: string,
): Promise<void> {
  const existing = await billingClientRepository.findByCode(code);

  if (existing && existing.id !== excludeId) {
    throw new BillingClientError(
      `Ya existe un cliente con el código "${code}".`,
      "DUPLICATE_CODE",
    );
  }
}

function sanitizeClientCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeBillingClientCode(trimmed);
  if (!normalized) {
    throw new BillingClientError(
      "El código debe tener el formato LETRAS-00000, por ejemplo GLR-00002.",
      "VALIDATION_ERROR",
    );
  }

  return normalized;
}

export class BillingClientService {
  async listClients(): Promise<BillingClient[]> {
    await requireAdmin();
    return billingClientRepository.findAllOrdered();
  }

  async getClient(id: string): Promise<BillingClient> {
    await requireAdmin();
    return requireBillingClient(id);
  }

  async createClient(input: BillingClientInput): Promise<BillingClient> {
    const { profile: admin } = await requireAdmin();
    const sanitized = sanitizeBillingClientInput(input);
    await ensureUniqueIdentification(
      sanitized.identificationType,
      sanitized.identificationNumber,
    );

    const client = await this.createWithGeneratedCode(sanitized);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.BILLING_CLIENT_CREATED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_CLIENT,
      entityId: client.id,
    });

    return client;
  }

  async ensureGenericClient(): Promise<BillingClient> {
    await requireAdmin();
    const existing = await billingClientRepository.findCanonicalGeneric();

    if (existing && isGenericBillingClient(existing)) {
      return existing;
    }

    return this.createClient({
      name: GENERIC_BILLING_CLIENT_NAME,
      identificationType: "NINGUNO",
      ivaCondition: "CONSUMIDOR_FINAL",
    });
  }

  async updateClient(input: UpdateBillingClientInput): Promise<BillingClient> {
    const { profile: admin } = await requireAdmin();
    await requireBillingClient(input.id);
    const sanitized = sanitizeBillingClientInput(input);
    await ensureUniqueIdentification(
      sanitized.identificationType,
      sanitized.identificationNumber,
      input.id,
    );
    const code = sanitizeClientCode(input.code);

    if (code) {
      await ensureUniqueClientCode(code, input.id);
    }

    try {
      const updated = await billingClientRepository.update(input.id, {
        ...sanitized,
        ...(code ? { code } : {}),
      });

      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.BILLING_CLIENT_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.BILLING_CLIENT,
        entityId: updated.id,
      });

      return updated;
    } catch (error) {
      if (billingClientRepository.isUniqueConstraintError(error) && code) {
        throw new BillingClientError(
          `Ya existe un cliente con el código "${code}".`,
          "DUPLICATE_CODE",
        );
      }
      throw error;
    }
  }

  async deleteClient(id: string): Promise<void> {
    const { profile: admin } = await requireAdmin();
    await requireBillingClient(id);
    await billingClientRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.BILLING_CLIENT_DELETED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_CLIENT,
      entityId: id,
    });
  }

  private async createWithGeneratedCode(
    sanitized: SanitizedBillingClientInput,
  ): Promise<BillingClient> {
    for (let attempt = 0; attempt < CODE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const codeNumber = await billingClientRepository.getNextCodeNumber();
      const data: CreateBillingClientData = {
        ...sanitized,
        codeNumber,
        code: buildBillingClientCode(sanitized.name, codeNumber),
      };

      try {
        return await billingClientRepository.create(data);
      } catch (error) {
        if (!billingClientRepository.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BillingClientError(
      "No se pudo generar un código de cliente único. Intente de nuevo.",
      "CODE_GENERATION_FAILED",
    );
  }
}

export const billingClientService = new BillingClientService();
