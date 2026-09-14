import { z } from "zod";

export const billingReceiptPaymentMethodSchema = z.enum([
  "EFECTIVO",
  "CHEQUE",
  "TRANSFERENCIA",
  "TARJETA",
  "OTROS",
]);

const allocationSchema = z.object({
  invoiceId: z.string().min(1, "Factura inválida."),
  amount: z.number().positive("El importe tiene que ser mayor a cero."),
});

export const createBillingReceiptSchema = z.object({
  clientId: z.string().min(1, "Elegí un cliente."),
  amount: z.number().positive("El importe tiene que ser mayor a cero."),
  paymentMethod: billingReceiptPaymentMethodSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Las observaciones no pueden superar 1000 caracteres.")
    .optional()
    .nullable(),
  useClientCredit: z.boolean().optional(),
  allocations: z.array(allocationSchema),
});

export const allocateBillingReceiptSchema = z.object({
  receiptId: z.string().min(1, "Recibo inválido."),
  notes: z
    .string()
    .trim()
    .max(1000, "Las observaciones no pueden superar 1000 caracteres.")
    .optional()
    .nullable(),
  allocations: z.array(allocationSchema).min(1, "Elegí al menos una factura."),
});

export type CreateBillingReceiptFormInput = z.infer<
  typeof createBillingReceiptSchema
>;
export type AllocateBillingReceiptFormInput = z.infer<
  typeof allocateBillingReceiptSchema
>;
