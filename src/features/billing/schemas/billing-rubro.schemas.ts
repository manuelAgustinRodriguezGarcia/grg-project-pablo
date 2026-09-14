import { z } from "zod";

export const billingRubroStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const billingRubroBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del rubro es obligatorio.")
    .max(120, "El nombre no puede superar 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede superar 500 caracteres.")
    .optional()
    .nullable(),
  status: billingRubroStatusSchema.optional(),
  code: z
    .string()
    .trim()
    .max(32, "El código no puede superar 32 caracteres.")
    .optional()
    .nullable(),
});

export const createBillingRubroSchema = billingRubroBaseSchema;

export const updateBillingRubroSchema = billingRubroBaseSchema.extend({
  id: z.string().min(1, "Identificador de rubro inválido."),
});

export const billingRubroIdSchema = z.object({
  rubroId: z.string().min(1, "Identificador de rubro inválido."),
});

export type CreateBillingRubroFormInput = z.infer<
  typeof createBillingRubroSchema
>;
export type UpdateBillingRubroFormInput = z.infer<
  typeof updateBillingRubroSchema
>;
export type BillingRubroIdInput = z.infer<typeof billingRubroIdSchema>;
