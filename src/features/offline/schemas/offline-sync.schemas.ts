import { z } from "zod";

export const offlineDeviceIdSchema = z.object({
  deviceId: z.string().uuid("deviceId debe ser un UUID válido."),
});

export const offlineFolderCursorSchema = z.object({
  cursor: z.string().optional(),
  chunkSize: z.coerce.number().int().min(1).max(500).default(500),
});

export const offlineCatalogIdQuerySchema = z.object({
  catalogId: z.string().min(1),
});
