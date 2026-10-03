-- Ticket de acceso WSAA cifrado. Tabla aditiva. No modifica facturación.

CREATE TYPE "ArcaAccessEnvironment" AS ENUM ('HOMOLOGACION', 'PRODUCCION');

CREATE TABLE "ArcaAccessTicketCache" (
    "id" TEXT NOT NULL,
    "environment" "ArcaAccessEnvironment" NOT NULL,
    "service" TEXT NOT NULL,
    "certificateFingerprint" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "generationTime" TIMESTAMP(3) NOT NULL,
    "expirationTime" TIMESTAMP(3) NOT NULL,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcaAccessTicketCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArcaAccessTicketCache_identity_key" ON "ArcaAccessTicketCache"("environment", "service", "certificateFingerprint");
