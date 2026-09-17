import { z } from "zod";
import {
  MAX_INVOICE_ITEM_QUANTITY,
  MAX_INVOICE_ITEM_UNIT_PRICE,
} from "@/shared/utils/billing-invoice-rules";

export const billingPaymentMethodSchema = z.enum([
  "CONTADO_EFECTIVO",
  "CONTADO",
  "TARJETA",
  "TRANSFERENCIA",
  "OTROS",
  "CUENTA_CORRIENTE",
]);

export const billingPaymentStatusSchema = z.enum([
  "IMPAGA",
  "PARCIALMENTE_PAGA",
  "PAGA",
  "ANULADA",
]);

const invoiceItemSchema = z.object({
  rubroId: z.string().min(1, "Seleccione un rubro."),
  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede superar 500 caracteres.")
    .optional()
    .nullable(),
  quantity: z
    .number()
    .positive("La cantidad debe ser mayor a cero.")
    .max(
      MAX_INVOICE_ITEM_QUANTITY,
      `La cantidad no puede superar ${MAX_INVOICE_ITEM_QUANTITY}.`,
    ),
  unitPrice: z
    .number()
    .positive("El precio unitario debe ser mayor a cero.")
    .max(
      MAX_INVOICE_ITEM_UNIT_PRICE,
      `El precio unitario no puede superar ${MAX_INVOICE_ITEM_UNIT_PRICE.toLocaleString("es-AR")}.`,
    ),
});

export const createBillingInvoiceSchema = z.object({
  clientId: z.string().min(1, "Seleccione un cliente."),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Agregue al menos un rubro a la factura."),
  discountPercent: z
    .number()
    .min(0, "El descuento no puede ser negativo.")
    .max(99.99, "El descuento debe ser menor a 100%.")
    .optional(),
  paymentMethod: billingPaymentMethodSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Las observaciones no pueden superar 1000 caracteres.")
    .optional()
    .nullable(),
});

export type CreateBillingInvoiceFormInput = z.infer<
  typeof createBillingInvoiceSchema
>;
