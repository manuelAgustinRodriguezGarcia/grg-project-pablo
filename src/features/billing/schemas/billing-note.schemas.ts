import { z } from "zod";

export const billingNoteKindSchema = z.enum(["CREDIT", "DEBIT"]);

export const createBillingNoteSchema = z.object({
  kind: billingNoteKindSchema,
  invoiceId: z.string().min(1, "Elegí una factura."),
  amount: z.number().positive("El importe tiene que ser mayor a cero."),
  reason: z
    .string()
    .trim()
    .min(1, "Indicá el motivo.")
    .max(1000, "El motivo no puede superar 1000 caracteres."),
});

export type CreateBillingNoteFormInput = z.infer<typeof createBillingNoteSchema>;
