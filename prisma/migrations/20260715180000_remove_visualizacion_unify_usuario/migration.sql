-- Unify VISUALIZACION into USUARIO (view-only). Only ADMIN and USUARIO remain.

UPDATE "User" SET role = 'USUARIO' WHERE role = 'VISUALIZACION';

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'USUARIO');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (role::text::"UserRole_new");

DROP TYPE "UserRole";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USUARIO'::"UserRole";
