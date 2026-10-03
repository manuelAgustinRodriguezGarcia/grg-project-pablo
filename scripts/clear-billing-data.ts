import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const EXECUTE_WARNING =
  "Esta operación eliminará todos los datos funcionales de Facturación.";

type Mode = "dry-run" | "execute";

function parseMode(argv: string[]): Mode {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const unknown = flags.filter(
    (flag) => flag !== "--dry-run" && flag !== "--execute",
  );

  if (unknown.length > 0) {
    throw new Error(`Flag no reconocida: ${unknown.join(", ")}.`);
  }

  if (flags.includes("--execute") && flags.includes("--dry-run")) {
    throw new Error("Usá solo --dry-run o solo --execute.");
  }

  if (flags.includes("--execute")) {
    return "execute";
  }

  return "dry-run";
}

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

async function reportEmissions(prisma: PrismaClient): Promise<number> {
  const emissions = await prisma.billingArcaEmission.findMany({
    select: {
      environment: true,
      status: true,
      voucherType: true,
      voucherNumber: true,
      invoiceId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`BillingArcaEmission: ${emissions.length}`);

  for (const emission of emissions) {
    console.log(
      [
        `environment=${emission.environment}`,
        `status=${emission.status}`,
        `voucherType=${emission.voucherType}`,
        `voucherNumber=${emission.voucherNumber ?? "null"}`,
        `invoiceId=${emission.invoiceId ?? "null"}`,
      ].join(" "),
    );
  }

  return emissions.length;
}

async function printDryRun(prisma: PrismaClient): Promise<void> {
  const emissionCount = await reportEmissions(prisma);

  if (emissionCount > 0) {
    console.log(
      "Limpieza detenida: hay filas en BillingArcaEmission. No se borró nada.",
    );
    process.exitCode = 1;
    return;
  }

  const [
    receiptAllocations,
    receipts,
    notes,
    invoiceItems,
    invoices,
    clients,
    rniClients,
    rubros,
    fiscalSettings,
    ticketCache,
    sequenceGroups,
  ] = await Promise.all([
    prisma.billingReceiptAllocation.count(),
    prisma.billingReceipt.count(),
    prisma.billingNote.count(),
    prisma.billingInvoiceItem.count(),
    prisma.billingInvoice.count(),
    prisma.billingClient.count(),
    prisma.billingClient.count({
      where: { ivaCondition: "RESPONSABLE_NO_INSCRIPTO" },
    }),
    prisma.billingRubro.count(),
    prisma.billingFiscalSettings.count(),
    prisma.arcaAccessTicketCache.count(),
    prisma.billingInvoice.groupBy({
      by: ["environment", "pointOfSale"],
      _max: { sequenceNumber: true },
    }),
  ]);

  console.log(`BillingReceiptAllocation: ${receiptAllocations}`);
  console.log(`BillingReceipt: ${receipts}`);
  console.log(`BillingNote: ${notes}`);
  console.log(`BillingInvoiceItem: ${invoiceItems}`);
  console.log(`BillingInvoice: ${invoices}`);
  console.log(`BillingClient: ${clients}`);
  console.log(`clientes RNI: ${rniClients}`);
  console.log(`BillingRubro: ${rubros}`);
  console.log(
    `BillingFiscalSettings (no se toca): ${fiscalSettings}`,
  );
  console.log(`ArcaAccessTicketCache (no se toca): ${ticketCache}`);

  if (sequenceGroups.length === 0) {
    console.log(
      "Numeración local: no hay facturas. getNextSequenceNumber devolvería 1.",
    );
  } else {
    for (const group of sequenceGroups) {
      const current = group._max.sequenceNumber ?? 0;
      console.log(
        `Numeración local actual ${group.environment} punto ${group.pointOfSale}: max(sequenceNumber)=${current}.`,
      );
    }
    console.log(
      "Con BillingInvoice vacía, getNextSequenceNumber devolvería 1 para cada ambiente y punto de venta. HOMOLOGACION no usa esa secuencia: el próximo número sale de FECompUltimoAutorizado.",
    );
  }

  console.log("DRY RUN. No se borró nada.");
}

async function executeClear(prisma: PrismaClient): Promise<void> {
  console.log(EXECUTE_WARNING);

  await prisma.$transaction(async (tx) => {
    const emissionCount = await tx.billingArcaEmission.count();

    if (emissionCount > 0) {
      throw new Error(
        `ABORT: BillingArcaEmission tiene ${emissionCount} fila(s). No se borró nada.`,
      );
    }

    await tx.billingReceiptAllocation.deleteMany();
    await tx.billingNote.deleteMany();
    await tx.billingReceipt.deleteMany();
    await tx.billingInvoiceItem.deleteMany();
    await tx.billingInvoice.deleteMany();
    await tx.billingClient.deleteMany();
    await tx.billingRubro.deleteMany();
  });

  console.log("Limpieza de datos funcionales de Facturación completada.");
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const prisma = createPrisma();

  try {
    if (mode === "dry-run") {
      await printDryRun(prisma);
      return;
    }

    await executeClear(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "✗ Limpieza de facturación detenida:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
