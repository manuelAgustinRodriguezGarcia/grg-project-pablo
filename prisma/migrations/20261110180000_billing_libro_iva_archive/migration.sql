-- Copia histórica de Libros de IVA mensuales. No altera comprobantes ni cálculos.
-- Aplicar a mano cuando corresponda. Esta migración no se ejecuta desde la aplicación.

-- CreateEnum
CREATE TYPE "BillingLibroIvaBookKind" AS ENUM ('MONTHLY');

-- CreateEnum
CREATE TYPE "BillingLibroIvaArchiveFormat" AS ENUM ('PDF', 'XLSX');

-- CreateTable
CREATE TABLE "BillingLibroIvaArchive" (
    "id" TEXT NOT NULL,
    "environment" "BillingFiscalEnvironment" NOT NULL,
    "bookKind" "BillingLibroIvaBookKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "format" "BillingLibroIvaArchiveFormat" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "fiscalDataSha256" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "generatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingLibroIvaArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingLibroIvaArchive_identity_key" ON "BillingLibroIvaArchive"("environment", "bookKind", "year", "month", "format");

-- AddForeignKey
ALTER TABLE "BillingLibroIvaArchive" ADD CONSTRAINT "BillingLibroIvaArchive_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
