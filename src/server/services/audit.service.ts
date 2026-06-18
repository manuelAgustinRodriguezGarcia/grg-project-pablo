import type { AuditAction, AuditEntityType } from "./audit.constants";
import {
  auditRepository,
  type CreateAuditLogInput,
} from "@/server/repositories/audit.repository";

export type LogAuditOperationInput = CreateAuditLogInput;

export class AuditService {
  async logOperation(input: LogAuditOperationInput): Promise<void> {
    try {
      await auditRepository.create(input);
    } catch (error) {
      console.error("[AuditService] Failed to log operation:", {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        error,
      });
    }
  }

  logOperationSafe(input: {
    userId?: string | null;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
  }): void {
    void this.logOperation(input);
  }
}

export const auditService = new AuditService();
