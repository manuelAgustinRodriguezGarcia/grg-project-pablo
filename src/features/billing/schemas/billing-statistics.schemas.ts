import { z } from "zod";

export const statisticsPeriodModeSchema = z.enum(["month", "year", "custom"]);

export const statisticsSearchParamsSchema = z
  .object({
    period: statisticsPeriodModeSchema,
    year: z.string().regex(/^\d{4}$/).optional(),
    month: z.string().regex(/^(?:0?[1-9]|1[0-2])$/).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.string().regex(/^[1-9]\d{0,3}$/).optional(),
    clientKey: z.string().min(1).max(2000).optional(),
    rubroKey: z.string().min(1).max(2000).optional(),
    comparePeriod: statisticsPeriodModeSchema.optional(),
    compareYear: z.string().regex(/^\d{4}$/).optional(),
    compareMonth: z.string().regex(/^(?:0?[1-9]|1[0-2])$/).optional(),
    compareFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    compareTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export type StatisticsSearchParams = z.infer<typeof statisticsSearchParamsSchema>;
export type StatisticsPeriodMode = z.infer<typeof statisticsPeriodModeSchema>;

export const statisticsYearSearchParamsSchema = z
  .object({
    year: z.string().regex(/^\d{4}$/),
  })
  .strict();
