import { z } from "zod";

export const billingIdentificationTypeSchema = z.enum([
  "CUIT",
  "DNI",
  "NINGUNO",
]);

export const billingIvaConditionSchema = z.enum([
  "RESPONSABLE_INSCRIPTO",
  "RESPONSABLE_NO_INSCRIPTO",
  "MONOTRIBUTISTA",
  "CONSUMIDOR_FINAL",
  "EXENTO",
]);

const optionalTextSchema = z
  .string()
  .trim()
  .max(160, "El texto no puede superar 160 caracteres.")
  .optional()
  .nullable();

const billingClientBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre o razón social es obligatorio.")
    .max(160, "El nombre no puede superar 160 caracteres."),
  address: optionalTextSchema,
  city: optionalTextSchema,
  province: optionalTextSchema,
  email: optionalTextSchema,
  whatsapp: z
    .string()
    .trim()
    .max(30, "El WhatsApp no puede superar 30 caracteres.")
    .optional()
    .nullable(),
  identificationType: billingIdentificationTypeSchema,
  identificationNumber: z
    .string()
    .trim()
    .max(20, "El documento no puede superar 20 caracteres.")
    .optional()
    .nullable(),
  ivaCondition: billingIvaConditionSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Las observaciones no pueden superar 1000 caracteres.")
    .optional()
    .nullable(),
});

export const createBillingClientSchema = billingClientBaseSchema;

export const updateBillingClientSchema = billingClientBaseSchema.extend({
  id: z.string().min(1, "Identificador de cliente inválido."),
  code: z
    .string()
    .trim()
    .min(4, "El código de cliente es obligatorio.")
    .max(24, "El código no puede superar 24 caracteres.")
    .optional(),
});

export const billingClientIdSchema = z.object({
  clientId: z.string().min(1, "Identificador de cliente inválido."),
});

export type CreateBillingClientFormInput = z.infer<
  typeof createBillingClientSchema
>;
export type UpdateBillingClientFormInput = z.infer<
  typeof updateBillingClientSchema
>;
export type BillingClientIdInput = z.infer<typeof billingClientIdSchema>;
