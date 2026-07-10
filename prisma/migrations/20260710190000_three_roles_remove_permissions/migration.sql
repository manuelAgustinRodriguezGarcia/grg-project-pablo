-- Add VISUALIZACION role (read-only; replaces legacy USUARIO semantics).
ALTER TYPE "UserRole" ADD VALUE 'VISUALIZACION';

-- Remap existing USUARIO rows to VISUALIZACION (they were read-only).
UPDATE "User" SET role = 'VISUALIZACION' WHERE role = 'USUARIO';

-- Remove granular permission tables (authorization is role-based only).
DROP TABLE IF EXISTS "RolePermission";
DROP TABLE IF EXISTS "Permission";

-- Default for new users without explicit role assignment.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VISUALIZACION';
