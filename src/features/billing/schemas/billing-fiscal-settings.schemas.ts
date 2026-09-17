import { z } from "zod";
import {
  MAX_GENERIC_CLIENT_LIMIT,
  MAX_IVA_PERCENT,
  MIN_GENERIC_CLIENT_LIMIT,
  MIN_IVA_PERCENT,
} from "@/features/billing/utils/fiscal-settings";

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

export type UpdateIvaPercentInput = z.infer<typeof updateIvaPercentSchema>;
export type UpdateGenericClientLimitInput = z.infer<
  typeof updateGenericClientLimitSchema
>;
