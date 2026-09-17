import { requireAdmin } from "@/server/auth";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { billingReceiptRepository } from "@/server/repositories/billing-receipt.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  activityFieldForKind,
  type BillingDocumentActivity,
  type BillingDocumentActivityKind,
  type BillingDocumentKind,
} from "@/features/billing/types/billing-document-activity";

function activityAuditAction(activity: BillingDocumentActivityKind) {
  switch (activity) {
    case "printed":
      return AUDIT_ACTIONS.BILLING_DOCUMENT_PRINTED;
    case "downloaded":
      return AUDIT_ACTIONS.BILLING_DOCUMENT_DOWNLOADED;
    case "shared":
      return AUDIT_ACTIONS.BILLING_DOCUMENT_SHARED;
    default: {
      const exhaustive: never = activity;
      return exhaustive;
    }
  }
}

function entityTypeForKind(kind: BillingDocumentKind) {
  switch (kind) {
    case "INVOICE":
      return AUDIT_ENTITY_TYPES.BILLING_INVOICE;
    case "RECEIPT":
      return AUDIT_ENTITY_TYPES.BILLING_RECEIPT;
    case "NOTE":
      return AUDIT_ENTITY_TYPES.BILLING_NOTE;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export class BillingDocumentActivityService {
  async mark(
    kind: BillingDocumentKind,
    id: string,
    activity: BillingDocumentActivityKind,
  ): Promise<BillingDocumentActivity> {
    const { profile: admin } = await requireAdmin();
    const at = new Date();
    const field = activityFieldForKind(activity);
    const data = { [field]: at };

    switch (kind) {
      case "INVOICE": {
        const invoice = await billingInvoiceRepository.findById(id);
        if (!invoice) {
          throw new BillingInvoiceError(
            "La factura no existe.",
            "BILLING_INVOICE_NOT_FOUND",
          );
        }
        await billingInvoiceRepository.markActivity(id, data);
        auditService.logOperationSafe({
          userId: admin.id,
          action: activityAuditAction(activity),
          entityType: entityTypeForKind(kind),
          entityId: id,
        });
        return {
          printedAt: field === "printedAt" ? at : invoice.printedAt,
          downloadedAt: field === "downloadedAt" ? at : invoice.downloadedAt,
          sharedAt: field === "sharedAt" ? at : invoice.sharedAt,
        };
      }
      case "RECEIPT": {
        const receipt = await billingReceiptRepository.findById(id);
        if (!receipt) {
          throw new BillingInvoiceError(
            "El recibo no existe.",
            "BILLING_RECEIPT_NOT_FOUND",
          );
        }
        await billingReceiptRepository.markActivity(id, data);
        auditService.logOperationSafe({
          userId: admin.id,
          action: activityAuditAction(activity),
          entityType: entityTypeForKind(kind),
          entityId: id,
        });
        return {
          printedAt: field === "printedAt" ? at : receipt.printedAt,
          downloadedAt: field === "downloadedAt" ? at : receipt.downloadedAt,
          sharedAt: field === "sharedAt" ? at : receipt.sharedAt,
        };
      }
      case "NOTE": {
        const note = await billingNoteRepository.findById(id);
        if (!note) {
          throw new BillingInvoiceError(
            "La nota no existe.",
            "BILLING_NOTE_NOT_FOUND",
          );
        }
        await billingNoteRepository.markActivity(id, data);
        auditService.logOperationSafe({
          userId: admin.id,
          action: activityAuditAction(activity),
          entityType: entityTypeForKind(kind),
          entityId: id,
        });
        return {
          printedAt: field === "printedAt" ? at : note.printedAt,
          downloadedAt: field === "downloadedAt" ? at : note.downloadedAt,
          sharedAt: field === "sharedAt" ? at : note.sharedAt,
        };
      }
      default: {
        const exhaustive: never = kind;
        return exhaustive;
      }
    }
  }
}

export const billingDocumentActivityService = new BillingDocumentActivityService();
