import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildBillingRubroCode } from "../src/server/services/billing-rubro-code";

type SeedRubro = {
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
};

const SEED_RUBROS: SeedRubro[] = [
  {
    name: "Embragues",
    description: "Kits y componentes de embrague para transporte pesado.",
    status: "ACTIVE",
  },
  {
    name: "Filtros",
    description: "Filtros de aire, aceite y combustible.",
    status: "ACTIVE",
  },
  {
    name: "Alternadores",
    description: "Alternadores y repuestos eléctricos asociados.",
    status: "ACTIVE",
  },
  {
    name: "Cardanes",
    description: "Cardanes, crucetas y componentes de transmisión.",
    status: "ACTIVE",
  },
  {
    name: "Frenos",
    description: "Pastillas, discos, cintas y accesorios de freno.",
    status: "ACTIVE",
  },
  {
    name: "Repuestos varios",
    description: "Conceptos generales de repuestos sin rubro específico.",
    status: "ACTIVE",
  },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const maxRecord = await prisma.billingRubro.aggregate({
      _max: { codeNumber: true },
    });
    let nextCodeNumber = (maxRecord._max.codeNumber ?? 0) + 1;

    for (const rubro of SEED_RUBROS) {
      const existing = await prisma.billingRubro.findFirst({
        where: { name: { equals: rubro.name, mode: "insensitive" } },
      });

      if (existing) {
        console.log(`- Ya existe, se omite: ${rubro.name} (${existing.code})`);
        continue;
      }

      const codeNumber = nextCodeNumber;
      nextCodeNumber += 1;

      const created = await prisma.billingRubro.create({
        data: {
          code: buildBillingRubroCode(rubro.name, codeNumber),
          codeNumber,
          name: rubro.name,
          description: rubro.description,
          status: rubro.status,
        },
      });

      console.log(`✓ Rubro creado: ${created.code} — ${created.name}`);
    }

    console.log("\nSeed de rubros de facturación finalizado.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Seed de rubros de facturación fallido:", error);
  process.exit(1);
});
