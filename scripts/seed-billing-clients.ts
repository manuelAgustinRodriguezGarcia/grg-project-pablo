import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildBillingClientCode } from "../src/server/services/billing-client-code";
import { isValidCuit } from "../src/shared/utils/identification";

type SeedClient = {
  name: string;
  address: string;
  city: string;
  province: string;
  email: string;
  whatsapp: string;
  identificationType: "CUIT" | "DNI" | "NINGUNO";
  identificationNumber: string | null;
  ivaCondition:
    | "RESPONSABLE_INSCRIPTO"
    | "RESPONSABLE_NO_INSCRIPTO"
    | "MONOTRIBUTISTA"
    | "CONSUMIDOR_FINAL"
    | "EXENTO";
  notes: string | null;
};

const SEED_CLIENTS: SeedClient[] = [
  {
    name: "METALURGICA SAN MARTIN S.A.",
    address: "Av. Belgrano 1450",
    city: "San Martín",
    province: "Buenos Aires",
    email: "administracion@metalurgicasanmartin.com.ar",
    whatsapp: "1145678901",
    identificationType: "CUIT",
    identificationNumber: "30712345671",
    ivaCondition: "RESPONSABLE_INSCRIPTO",
    notes: "Compra repuestos de embrague todos los meses.",
  },
  {
    name: "DISTRIBUIDORA EL FARO",
    address: "Mitre 823",
    city: "Rosario",
    province: "Santa Fe",
    email: "compras@elfarodistribuciones.com.ar",
    whatsapp: "3414567890",
    identificationType: "CUIT",
    identificationNumber: "20234567897",
    ivaCondition: "RESPONSABLE_NO_INSCRIPTO",
    notes: null,
  },
  {
    name: "GOMERIA LA RUTA",
    address: "Ruta 9 Km 42",
    city: "Córdoba",
    province: "Córdoba",
    email: "gomerialaruta@gmail.com",
    whatsapp: "3512345678",
    identificationType: "CUIT",
    identificationNumber: "27334445556",
    ivaCondition: "MONOTRIBUTISTA",
    notes: "Retira los pedidos personalmente.",
  },
  {
    name: "JUAN PEREZ",
    address: "Los Ceibos 210",
    city: "Quilmes",
    province: "Buenos Aires",
    email: "juanperez84@hotmail.com",
    whatsapp: "1167890123",
    identificationType: "DNI",
    identificationNumber: "32456789",
    ivaCondition: "CONSUMIDOR_FINAL",
    notes: null,
  },
  {
    name: "FUNDACION RUEDAS SOLIDARIAS",
    address: "Calle 7 N° 1580",
    city: "La Plata",
    province: "Buenos Aires",
    email: "contacto@ruedassolidarias.org.ar",
    whatsapp: "2214455667",
    identificationType: "CUIT",
    identificationNumber: "33709876541",
    ivaCondition: "EXENTO",
    notes: "Entidad sin fines de lucro, exenta de IVA.",
  },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida.");
  }

  for (const client of SEED_CLIENTS) {
    if (client.identificationType === "CUIT") {
      if (!client.identificationNumber || !isValidCuit(client.identificationNumber)) {
        throw new Error(`CUIT inválido para ${client.name}`);
      }
    }
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const maxRecord = await prisma.billingClient.aggregate({
      _max: { codeNumber: true },
    });
    let nextCodeNumber = (maxRecord._max.codeNumber ?? 0) + 1;

    const existingClients = await prisma.billingClient.findMany({
      orderBy: { codeNumber: "asc" },
    });

    for (const client of existingClients) {
      const nextCode = buildBillingClientCode(client.name, client.codeNumber);
      if (client.code === nextCode) {
        continue;
      }

      await prisma.billingClient.update({
        where: { id: client.id },
        data: { code: nextCode },
      });
      console.log(`✓ Código actualizado: ${client.code} → ${nextCode}`);
    }

    for (const client of SEED_CLIENTS) {
      const existing = await prisma.billingClient.findFirst({
        where: { name: client.name },
      });

      if (existing) {
        console.log(`- Ya existe, se omite: ${client.name} (${existing.code})`);
        continue;
      }

      const codeNumber = nextCodeNumber;
      nextCodeNumber += 1;

      const created = await prisma.billingClient.create({
        data: {
          code: buildBillingClientCode(client.name, codeNumber),
          codeNumber,
          name: client.name,
          address: client.address,
          city: client.city,
          province: client.province,
          email: client.email,
          whatsapp: client.whatsapp,
          identificationType: client.identificationType,
          identificationNumber: client.identificationNumber,
          ivaCondition: client.ivaCondition,
          notes: client.notes,
        },
      });

      console.log(
        `✓ Cliente creado: ${created.code} — ${created.name} (${created.ivaCondition})`,
      );
    }

    console.log("\nSeed de clientes de facturación finalizado.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Seed de clientes de facturación fallido:", error);
  process.exit(1);
});
