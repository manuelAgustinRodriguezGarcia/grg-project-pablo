import { createSupabaseBrowserClient } from "@/server/auth/supabase-browser";

export type SignedUploadTarget = {
  bucket: string;
  path: string;
  token: string;
  contentType: string;
  originalFilename: string;
};

export async function uploadFileToSignedTarget(
  target: SignedUploadTarget,
  file: File,
): Promise<void> {
  const client = createSupabaseBrowserClient();
  const { error } = await client.storage
    .from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, file, {
      contentType: target.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(
      error.message || `No se pudo subir ${target.originalFilename} a Storage.`,
    );
  }
}

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: string; status: number }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string })
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    return {
      ok: false,
      error:
        payload && typeof payload === "object" && typeof payload.error === "string"
          ? payload.error
          : "No se pudo completar la operación.",
      code:
        payload && typeof payload === "object" && typeof payload.code === "string"
          ? payload.code
          : undefined,
      status: response.status,
    };
  }

  return { ok: true, data: payload as T };
}
