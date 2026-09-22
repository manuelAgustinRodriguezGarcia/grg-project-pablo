import type {
  BillingRubro,
  BillingRubroStatus,
} from "@/generated/prisma/client";
import { requireAnyPermission, requirePermission } from "@/server/auth";
import {
  billingRubroRepository,
  type CreateBillingRubroData,
} from "@/server/repositories/billing-rubro.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { buildBillingRubroCode } from "./billing-rubro-code";
import { BillingRubroError } from "./billing-rubro.errors";

const CODE_GENERATION_MAX_ATTEMPTS = 5;
const CODE_MAX_LENGTH = 32;
const CODE_PATTERN = /^[A-Z0-9-]{2,32}$/;

export type BillingRubroInput = {
  name: string;
  description?: string | null;
  status?: BillingRubroStatus;
  code?: string | null;
};

export type UpdateBillingRubroInput = BillingRubroInput & {
  id: string;
};

type SanitizedBillingRubroInput = {
  name: string;
  description: string | null;
  status: BillingRubroStatus;
};

function sanitizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeBillingRubroInput(
  input: BillingRubroInput,
): SanitizedBillingRubroInput {
  const name = input.name.trim();

  if (!name) {
    throw new BillingRubroError(
      "El nombre del rubro es obligatorio.",
      "VALIDATION_ERROR",
    );
  }

  return {
    name,
    description: sanitizeOptionalText(input.description),
    status: input.status ?? "ACTIVE",
  };
}

async function requireBillingRubro(id: string): Promise<BillingRubro> {
  const rubro = await billingRubroRepository.findById(id);

  if (!rubro) {
    throw new BillingRubroError(
      "Rubro no encontrado.",
      "BILLING_RUBRO_NOT_FOUND",
    );
  }

  return rubro;
}

function sanitizeCode(value: string | null | undefined): string | null {
  const compact = value?.trim().toUpperCase().replace(/\s+/g, "") ?? "";

  if (!compact) {
    return null;
  }

  if (compact.length > CODE_MAX_LENGTH || !CODE_PATTERN.test(compact)) {
    throw new BillingRubroError(
      "El código debe tener entre 2 y 32 caracteres, solo letras, números y guiones.",
      "VALIDATION_ERROR",
    );
  }

  return compact;
}

async function ensureUniqueName(
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await billingRubroRepository.findByName(name);

  if (existing && existing.id !== excludeId) {
    throw new BillingRubroError(
      `Ya existe un rubro con el nombre "${existing.name}".`,
      "DUPLICATE_NAME",
    );
  }
}

async function ensureUniqueCode(
  code: string,
  excludeId?: string,
): Promise<void> {
  const existing = await billingRubroRepository.findByCode(code);

  if (existing && existing.id !== excludeId) {
    throw new BillingRubroError(
      `Ya existe un rubro con el código "${existing.code}".`,
      "DUPLICATE_CODE",
    );
  }
}

export class BillingRubroService {
  async listRubros(): Promise<BillingRubro[]> {
    await requireAnyPermission(["categories.read", "invoices.create"]);
    return billingRubroRepository.findAllOrdered();
  }

  async getRubro(id: string): Promise<BillingRubro> {
    await requireAnyPermission(["categories.read", "invoices.create"]);
    return requireBillingRubro(id);
  }

  async createRubro(input: BillingRubroInput): Promise<BillingRubro> {
    const { profile: admin } = await requirePermission("categories.create");
    const sanitized = sanitizeBillingRubroInput(input);
    const customCode = sanitizeCode(input.code);
    await ensureUniqueName(sanitized.name);

    const rubro = customCode
      ? await this.createWithCustomCode(sanitized, customCode)
      : await this.createWithGeneratedCode(sanitized);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.BILLING_RUBRO_CREATED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_RUBRO,
      entityId: rubro.id,
    });

    return rubro;
  }

  async updateRubro(input: UpdateBillingRubroInput): Promise<BillingRubro> {
    const { profile: admin } = await requirePermission("categories.update");
    const existing = await requireBillingRubro(input.id);
    const sanitized = sanitizeBillingRubroInput(input);
    const nextCode = sanitizeCode(input.code);
    await ensureUniqueName(sanitized.name, input.id);

    if (nextCode && nextCode !== existing.code) {
      await ensureUniqueCode(nextCode, input.id);
    }

    const updated = await this.updateHandlingUniqueConstraints(input.id, {
      name: sanitized.name,
      description: sanitized.description,
      status: input.status ?? existing.status,
      ...(nextCode && nextCode !== existing.code ? { code: nextCode } : {}),
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.BILLING_RUBRO_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_RUBRO,
      entityId: updated.id,
    });

    return updated;
  }

  async deleteRubro(id: string): Promise<void> {
    const { profile: admin } = await requirePermission("categories.delete");
    await requireBillingRubro(id);
    await billingRubroRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.BILLING_RUBRO_DELETED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_RUBRO,
      entityId: id,
    });
  }

  private async updateHandlingUniqueConstraints(
    id: string,
    data: {
      name: string;
      description: string | null;
      status: BillingRubroStatus;
      code?: string;
    },
  ): Promise<BillingRubro> {
    try {
      return await billingRubroRepository.update(id, data);
    } catch (error) {
      if (billingRubroRepository.isUniqueNameError(error)) {
        throw new BillingRubroError(
          `Ya existe un rubro con el nombre "${data.name}".`,
          "DUPLICATE_NAME",
        );
      }
      if (billingRubroRepository.isUniqueCodeError(error) && data.code) {
        throw new BillingRubroError(
          `Ya existe un rubro con el código "${data.code}".`,
          "DUPLICATE_CODE",
        );
      }
      throw error;
    }
  }

  private async createWithCustomCode(
    sanitized: SanitizedBillingRubroInput,
    code: string,
  ): Promise<BillingRubro> {
    await ensureUniqueCode(code);

    for (let attempt = 0; attempt < CODE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const codeNumber = await billingRubroRepository.getNextCodeNumber();
      const data: CreateBillingRubroData = {
        ...sanitized,
        codeNumber,
        code,
      };

      try {
        return await billingRubroRepository.create(data);
      } catch (error) {
        if (billingRubroRepository.isUniqueNameError(error)) {
          throw new BillingRubroError(
            `Ya existe un rubro con el nombre "${sanitized.name}".`,
            "DUPLICATE_NAME",
          );
        }
        if (billingRubroRepository.isUniqueCodeError(error)) {
          throw new BillingRubroError(
            `Ya existe un rubro con el código "${code}".`,
            "DUPLICATE_CODE",
          );
        }
        if (!billingRubroRepository.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BillingRubroError(
      "No se pudo generar un código de rubro único. Intente de nuevo.",
      "CODE_GENERATION_FAILED",
    );
  }

  private async createWithGeneratedCode(
    sanitized: SanitizedBillingRubroInput,
  ): Promise<BillingRubro> {
    for (let attempt = 0; attempt < CODE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const codeNumber = await billingRubroRepository.getNextCodeNumber();
      const data: CreateBillingRubroData = {
        ...sanitized,
        codeNumber,
        code: buildBillingRubroCode(sanitized.name, codeNumber),
      };

      try {
        return await billingRubroRepository.create(data);
      } catch (error) {
        if (billingRubroRepository.isUniqueNameError(error)) {
          throw new BillingRubroError(
            `Ya existe un rubro con el nombre "${sanitized.name}".`,
            "DUPLICATE_NAME",
          );
        }
        if (!billingRubroRepository.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BillingRubroError(
      "No se pudo generar un código de rubro único. Intente de nuevo.",
      "CODE_GENERATION_FAILED",
    );
  }
}

export const billingRubroService = new BillingRubroService();
