import { describe, expect, it } from "vitest";
import { AuthError, AuthForbiddenError } from "@/server/auth/errors";
import {
  handleAdminApiError,
  mapImportErrorToResponse,
} from "@/server/api/admin-api-error";
import { ImportError } from "@/server/services/import.errors";

describe("admin-api-error", () => {
  it("mapea UNAUTHENTICATED a 401", async () => {
    const response = handleAdminApiError(
      new AuthError("No auth", "UNAUTHENTICATED"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("mapea FORBIDDEN a 403", async () => {
    const response = handleAdminApiError(new AuthForbiddenError());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("mapea ImportError a respuesta con código", async () => {
    const response = mapImportErrorToResponse(
      new ImportError("Job no encontrado", "IMPORT_NOT_FOUND"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Job no encontrado",
      code: "IMPORT_NOT_FOUND",
    });
  });

  it("relanza errores desconocidos", () => {
    expect(() => handleAdminApiError(new Error("boom"))).toThrow("boom");
  });
});
