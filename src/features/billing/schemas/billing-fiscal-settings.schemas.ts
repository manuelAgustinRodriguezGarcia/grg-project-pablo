import { z } from "zod";
import { parseActivitiesStartedAt } from "@/features/billing/utils/issuer-fiscal-configuration";
import {
  MAX_GENERIC_CLIENT_LIMIT,
  MAX_IVA_PERCENT,
  MIN_GENERIC_CLIENT_LIMIT,
  MIN_IVA_PERCENT,
} from "@/features/billing/utils/fiscal-settings";
import { isValidCuit } from "@/shared/utils/identification";

export const updateIvaPercentSchema = z.object({
  ivaPercent: z
    .number()
    .min(MIN_IVA_PERCENT, `El IVA no puede ser menor a ${MIN_IVA_PERCENT}%.`)
    .max(MAX_IVA_PERCENT, `El IVA no puede superar ${MAX_IVA_PERCENT}%.`),
});

export const updateGenericClientLimitSchema = z.object({
  genericClientLimit: z
    .number()
    .min(
      MIN_GENERIC_CLIENT_LIMIT,
      "El límite de cliente genérico debe ser mayor a cero.",
    )
    .max(
      MAX_GENERIC_CLIENT_LIMIT,
      `El límite no puede superar ${MAX_GENERIC_CLIENT_LIMIT.toLocaleString("es-AR")}.`,
    ),
});

const requiredIssuerText = (message: string) =>
  z.string().trim().min(1, message);

export const updateIssuerFiscalSettingsSchema = z.object({
  issuerName: requiredIssuerText("La razón social es obligatoria."),
  issuerCuit: z
    .string()
    .trim()
    .refine((value) => isValidCuit(value), "El CUIT del emisor no es válido."),
  issuerAddress: requiredIssuerText("El domicilio comercial es obligatorio."),
  issuerCity: requiredIssuerText("La localidad es obligatoria."),
  issuerProvince: requiredIssuerText("La provincia es obligatoria."),
  issuerIvaCondition: requiredIssuerText(
    "La condición frente al IVA es obligatoria.",
  ),
  issuerGrossIncome: requiredIssuerText("Los ingresos brutos son obligatorios."),
  issuerActivitiesStartedAt: z
    .string()
    .trim()
    .refine(
      (value) => parseActivitiesStartedAt(value) !== null,
      "La fecha de inicio de actividades no es válida.",
    ),
});

export type UpdateIvaPercentInput = z.infer<typeof updateIvaPercentSchema>;
export type UpdateGenericClientLimitInput = z.infer<
  typeof updateGenericClientLimitSchema
>;
export type UpdateIssuerFiscalSettingsInput = z.infer<
  typeof updateIssuerFiscalSettingsSchema
>;
