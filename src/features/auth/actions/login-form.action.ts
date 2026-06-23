"use server";

import type { AuthActionResult } from "@/server/auth/types";
import { resolveSafeRedirectPath } from "@/server/auth/safe-redirect";
import { signInAction } from "./auth.actions";

export async function loginFormAction(
  _prevState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult | null> {
  const redirectTo = formData.get("redirectTo");

  return signInAction(
    {
      email: formData.get("email"),
      password: formData.get("password"),
    },
    resolveSafeRedirectPath(typeof redirectTo === "string" ? redirectTo : null),
  );
}
