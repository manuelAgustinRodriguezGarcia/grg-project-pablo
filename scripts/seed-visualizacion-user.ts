import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const SEED_EMAIL =
  process.env.SEED_VISUALIZACION_EMAIL ?? "grgvisualizacion@gmail.com";
const SEED_PASSWORD =
  process.env.SEED_VISUALIZACION_PASSWORD ?? "grgsolutions";
const SEED_NAME = process.env.SEED_VISUALIZACION_NAME ?? "visualizacionGRG";
const SEED_ROLE = "VISUALIZACION" as const;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  email: string,
) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw new Error(`No se pudo listar usuarios de Supabase: ${error.message}`);
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (match) {
      return match;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function main(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    let authUser = await findAuthUserByEmail(supabase, SEED_EMAIL);

    if (authUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: SEED_NAME,
          role: SEED_ROLE,
        },
      });

      if (error) {
        throw new Error(`No se pudo actualizar el usuario en Supabase: ${error.message}`);
      }

      authUser = data.user;
      console.log(`✓ Usuario Supabase existente actualizado: ${SEED_EMAIL}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: SEED_NAME,
          role: SEED_ROLE,
        },
      });

      if (error) {
        throw new Error(`No se pudo crear el usuario en Supabase: ${error.message}`);
      }

      authUser = data.user;
      console.log(`✓ Usuario Supabase creado: ${SEED_EMAIL}`);
    }

    if (!authUser) {
      throw new Error("Supabase no devolvió el usuario de autenticación.");
    }

    const profile = await prisma.user.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        email: SEED_EMAIL,
        name: SEED_NAME,
        role: SEED_ROLE,
        status: "ACTIVE",
      },
      update: {
        email: SEED_EMAIL,
        name: SEED_NAME,
        role: SEED_ROLE,
        status: "ACTIVE",
      },
    });

    console.log(`✓ Perfil local sincronizado: ${profile.name} (${profile.role})`);
    console.log("\nUsuario VISUALIZACION listo para login en /auth/login");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Seed de usuario VISUALIZACION fallido:", error);
  process.exit(1);
});
