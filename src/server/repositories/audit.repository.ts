import type { AuditLog } from "@/generated/prisma/client";
import type { AuditAction, AuditEntityType } from "@/server/services/audit.constants";
import { prisma } from "@/server/database/prisma";

export type CreateAuditLogInput = {
  userId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
};

export class AuditRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  }
}

export const auditRepository = new AuditRepository();
