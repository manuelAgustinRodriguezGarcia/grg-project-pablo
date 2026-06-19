import type { Metadata } from "next";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LoginFormCard } from "@/features/auth/components/LoginFormCard";
import { LoginHeader } from "@/features/auth/components/LoginHeader";
import { LoginImagePanel } from "@/features/auth/components/LoginImagePanel";
import sharedStyles from "@/features/auth/styles/loginShared.module.scss";
import styles from "./login.module.scss";

export const metadata: Metadata = {
  title: "Iniciar Sesión | Rothamel Repuestos",
  description:
    "Acceso exclusivo para usuarios autorizados y administradores de Rothamel Repuestos.",
};

function resolveRedirectTo(redirectTo?: string): string {
  if (!redirectTo?.startsWith("/") || redirectTo.startsWith("//")) {
    return "/admin";
  }

  return redirectTo;
}

type LoginPageProps = {
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <div className={styles.page}>
      <LoginHeader />

      <main className={styles.main}>
        <div className={styles.split}>
          <LoginImagePanel />

          <div
            className={`${styles.content} ${sharedStyles.animateSlideUp}`}
          >
            <div className={styles.formWrap}>
              <LoginFormCard redirectTo={resolveRedirectTo(redirectTo)} />
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
