import "dotenv/config";
import { createServerClient } from "@supabase/ssr";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  AUTH_LOGIN_PATH,
  AUTH_PUBLIC_PATHS,
  PROTECTED_PATH_PREFIXES,
  getSupabasePublicEnv,
} from "../src/server/auth";

async function verifySupabaseSsrClient(): Promise<void> {
  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => undefined,
    },
  });

  const { error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Cliente SSR: ${error.message}`);
  }

  console.log("✓ Cliente Supabase SSR (anon): inicialización OK");
}

async function verifyPrismaUserModel(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.user.count();
    console.log("✓ Modelo User: acceso Prisma OK");
  } finally {
    await prisma.$disconnect();
  }
}

function verifyAuthConfig(): void {
  const requiredPaths = [
    AUTH_LOGIN_PATH,
    ...AUTH_PUBLIC_PATHS,
    ...PROTECTED_PATH_PREFIXES,
  ];

  if (requiredPaths.length < 4) {
    throw new Error("Configuración de rutas de auth incompleta.");
  }

  console.log("✓ Rutas de auth configuradas:");
  console.log(`  Públicas: ${AUTH_PUBLIC_PATHS.join(", ")}`);
  console.log(`  Protegidas: ${PROTECTED_PATH_PREFIXES.join(", ")}`);
}

async function main(): Promise<void> {
  verifyAuthConfig();
  getSupabasePublicEnv();
  console.log("✓ Variables de entorno Supabase (públicas): OK");
  await verifySupabaseSsrClient();
  await verifyPrismaUserModel();
  console.log("\nVerificación de autenticación completada.");
  console.log(
    "Nota: el flujo completo (login/logout) requiere un usuario en Supabase Auth y perfil en tabla User.",
  );
}

main().catch((error: unknown) => {
  console.error("✗ Verificación de autenticación fallida:", error);
  process.exit(1);
});
