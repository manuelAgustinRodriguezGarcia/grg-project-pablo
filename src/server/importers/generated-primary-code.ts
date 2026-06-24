import { randomBytes } from "node:crypto";

export const GENERATED_PRIMARY_CODE_COLUMN_KEY = "codigo_generado";
export const GENERATED_PRIMARY_CODE_DISPLAY_NAME = "Código";

const GENERATED_CODE_BYTE_LENGTH = 3;
const MAX_GENERATION_ATTEMPTS = 32;

export function generateImportPrimaryCode(used: Set<string>): string {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = randomBytes(GENERATED_CODE_BYTE_LENGTH).toString("hex");

    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }

  throw new Error("No se pudieron generar códigos únicos para la importación.");
}
