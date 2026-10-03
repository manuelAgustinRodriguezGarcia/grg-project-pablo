import "server-only";
import type { BillingArcaEmission } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import type { ArcaCaeFiscalRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { parseBillingPayloadSnapshot } from "@/server/arca/invoices/billing-payload-snapshot";
import type {
  ApprovedEmissionUpdate,
  ArcaCodedItem,
  ArcaEmissionRecord,
  ArcaEmissionStore,
  CreatePreparedEmission,
  EmissionFailureUpdate,
  RejectedEmissionUpdate,
  SendingEmissionUpdate,
} from "@/server/arca/invoices/emission-store";
import {
  DuplicateArcaEmissionKeyError,
  DuplicateArcaVoucherNumberError,
} from "@/server/arca/invoices/emission-store";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { prisma } from "@/server/database/prisma";

const WSFE_SERVICE = "wsfe";

function codedItems(value: Prisma.JsonValue | null): ArcaCodedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    if (typeof record.code !== "string" || typeof record.message !== "string") {
      return [];
    }

    return [{ code: record.code, message: record.message }];
  });
}

function readSnapshot(value: Prisma.JsonValue | null): ArcaCaeFiscalRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as ArcaCaeFiscalRequest;
}

function readResult(value: string | null): "A" | "R" | null {
  if (value === "A" || value === "R") {
    return value;
  }

  return null;
}

function readReprocess(value: string | null): "S" | "N" | null {
  if (value === "S" || value === "N") {
    return value;
  }

  return null;
}

function readEnvironment(value: BillingArcaEmission["environment"]): ArcaEnvironment {
  switch (value) {
    case "HOMOLOGACION":
    case "PRODUCCION":
      return value;
    default: {
      const unexpected: never = value;
      return unexpected;
    }
  }
}

function toRecord(row: BillingArcaEmission): ArcaEmissionRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    requestHash: row.requestHash,
    environment: readEnvironment(row.environment),
    service: row.service,
    status: row.status,
    issuerCuit: row.issuerCuit,
    pointOfSale: row.pointOfSale,
    invoiceType: row.invoiceType,
    voucherType: row.voucherType,
    voucherNumber: row.voucherNumber,
    fiscalRequestSnapshot: readSnapshot(row.fiscalRequestSnapshot),
    arcaResult: readResult(row.arcaResult),
    authorizationCode: row.authorizationCode,
    authorizationExpiresAt: row.authorizationExpiresAt,
    arcaProcessDate: row.arcaProcessDate,
    reprocess: readReprocess(row.reprocess),
    observations: codedItems(row.observations),
    errors: codedItems(row.errors),
    events: codedItems(row.events),
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    billingPayloadSnapshot: parseBillingPayloadSnapshot(row.billingPayloadSnapshot),
    invoiceId: row.invoiceId,
  };
}

function throwConstraint(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = JSON.stringify(error.meta?.target ?? "");

    if (target.includes("idempotencyKey")) {
      throw new DuplicateArcaEmissionKeyError();
    }

    if (target.includes("voucher")) {
      throw new DuplicateArcaVoucherNumberError();
    }
  }

  throw error;
}

async function updateOrThrow(
  id: string,
  data: Prisma.BillingArcaEmissionUpdateInput,
): Promise<ArcaEmissionRecord> {
  try {
    const row = await prisma.billingArcaEmission.update({
      where: { id },
      data,
    });
    return toRecord(row);
  } catch (error) {
    throwConstraint(error);
  }
}

export const arcaEmissionRepository: ArcaEmissionStore = {
  async findByIdempotencyKey(key) {
    const row = await prisma.billingArcaEmission.findUnique({
      where: { idempotencyKey: key },
    });
    return row ? toRecord(row) : null;
  },

  async findById(id) {
    const row = await prisma.billingArcaEmission.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  },

  async createPrepared(data: CreatePreparedEmission) {
    try {
      const { billingPayloadSnapshot, ...rest } = data;
      const row = await prisma.billingArcaEmission.create({
        data: {
          ...rest,
          service: WSFE_SERVICE,
          status: "PREPARED",
          billingPayloadSnapshot: billingPayloadSnapshot as Prisma.InputJsonValue,
        },
      });
      return toRecord(row);
    } catch (error) {
      throwConstraint(error);
    }
  },

  async updateSending(id: string, data: SendingEmissionUpdate) {
    return updateOrThrow(id, {
      status: "SENDING",
      voucherNumber: data.voucherNumber,
      voucherType: data.voucherType,
      fiscalRequestSnapshot: data.fiscalRequestSnapshot,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  },

  async markApproved(id: string, data: ApprovedEmissionUpdate) {
    return updateOrThrow(id, {
      status: "APPROVED_PENDING_PERSISTENCE",
      arcaResult: "A",
      authorizationCode: data.authorizationCode,
      authorizationExpiresAt: data.authorizationExpiresAt,
      arcaProcessDate: data.arcaProcessDate,
      reprocess: data.reprocess,
      observations: data.observations,
      events: data.events,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  },

  async markRejected(id: string, data: RejectedEmissionUpdate) {
    return updateOrThrow(id, {
      status: "REJECTED",
      arcaResult: "R",
      authorizationCode: null,
      observations: data.observations,
      errors: data.errors,
      events: data.events,
    });
  },

  async markAmbiguous(id: string, data: EmissionFailureUpdate) {
    return updateOrThrow(id, {
      status: "AMBIGUOUS",
      lastErrorCode: data.code,
      lastErrorMessage: data.message,
    });
  },

  async markFailedPreSend(id: string, data: EmissionFailureUpdate) {
    return updateOrThrow(id, {
      status: "FAILED_PRE_SEND",
      lastErrorCode: data.code,
      lastErrorMessage: data.message,
      ...(data.clearVoucherNumber
        ? { voucherNumber: null, fiscalRequestSnapshot: Prisma.DbNull }
        : {}),
    });
  },
};

type EmissionDb = Prisma.TransactionClient;

export async function findArcaEmissionInTransaction(
  id: string,
  db: EmissionDb,
): Promise<ArcaEmissionRecord | null> {
  const row = await db.billingArcaEmission.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

export async function markArcaEmissionCompleted(
  id: string,
  invoiceId: string,
  db: EmissionDb,
): Promise<ArcaEmissionRecord> {
  const row = await db.billingArcaEmission.update({
    where: { id },
    data: {
      status: "COMPLETED",
      invoiceId,
    },
  });
  return toRecord(row);
}
