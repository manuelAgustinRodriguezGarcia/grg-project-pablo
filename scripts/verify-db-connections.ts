import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";

async function verifyConnection(
  label: string,
  connectionString: string | undefined,
): Promise<void> {
  if (!connectionString) {
    throw new Error(`${label} no está definida.`);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await prisma.$queryRaw<[{ ok: number }]>`SELECT 1 AS ok`;
    if (result[0]?.ok !== 1) {
      throw new Error(`Respuesta inesperada: ${JSON.stringify(result)}`);
    }
    console.log(`✓ ${label}: conexión OK`);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifySupabaseClient(
  label: string,
  url: string | undefined,
  apiKey: string | undefined,
): Promise<void> {
  if (!url) {
    throw new Error(`${label}: NEXT_PUBLIC_SUPABASE_URL no está definida.`);
  }
  if (!url.startsWith("https://")) {
    throw new Error(
      `${label}: NEXT_PUBLIC_SUPABASE_URL debe ser una URL (https://...supabase.co), no una clave API.`,
    );
  }
  if (!apiKey) {
    throw new Error(`${label}: clave API no está definida.`);
  }

  const client = createClient(url, apiKey);
  const { error } = await client.auth.getSession();
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  console.log(`✓ ${label}: conexión OK`);
}

async function main(): Promise<void> {
  await verifyConnection("DATABASE_URL (pooled)", process.env.DATABASE_URL);
  await verifyConnection("DIRECT_URL (directa)", process.env.DIRECT_URL);
  await verifySupabaseClient(
    "Supabase (anon key)",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  await verifySupabaseClient(
    "Supabase (service role key)",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

main().catch((error: unknown) => {
  console.error("✗ Verificación de conexión fallida:", error);
  process.exit(1);
});
