import { z } from "zod";

export const uploadedFileListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

export const uploadedFileReportQuerySchema = z.object({
  jobId: z.string().trim().min(1).optional(),
});

export const uploadedFileDeleteBodySchema = z.object({
  confirmed: z.boolean().default(false),
});

export const uploadedFileIdSchema = z.object({
  fileId: z.string().trim().min(1),
});

export type UploadedFileListQuery = z.infer<typeof uploadedFileListQuerySchema>;
export type UploadedFileReportQuery = z.infer<typeof uploadedFileReportQuerySchema>;
export type UploadedFileDeleteBody = z.infer<typeof uploadedFileDeleteBodySchema>;
