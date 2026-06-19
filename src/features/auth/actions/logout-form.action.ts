"use server";

import { redirect } from "next/navigation";
import { AUTH_LOGIN_PATH } from "@/server/auth/config";
import { signOutAction } from "./auth.actions";

export async function logoutFormAction(): Promise<void> {
  const result = await signOutAction();

  if (!result.success) {
    redirect(`${AUTH_LOGIN_PATH}?error=logout_failed`);
  }

  redirect(AUTH_LOGIN_PATH);
}
