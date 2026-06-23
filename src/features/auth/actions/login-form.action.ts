"use server";

import type { AuthActionResult } from "@/server/auth/types";
import { ADMIN_HOME_PATH } from "@/server/auth/config";
import { signInAction } from "./auth.actions";

function resolveRedirectTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return ADMIN_HOME_PATH;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return ADMIN_HOME_PATH;
  }

  return trimmed;
}

export async function loginFormAction(
  _prevState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult | null> {
  return signInAction(
    {
      email: formData.get("email"),
      password: formData.get("password"),
    },
    resolveRedirectTo(formData.get("redirectTo")),
  );
}
