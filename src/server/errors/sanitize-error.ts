const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Inténtalo de nuevo.";

/**
 * Devuelve un mensaje seguro para exponer al cliente.
 * Los detalles internos deben registrarse en el servidor antes de llamar a esta función.
 */
export function getSafeClientMessage(
  error: unknown,
  fallback = GENERIC_ERROR_MESSAGE,
): string {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return error.message;
  }

  return fallback;
}

export { GENERIC_ERROR_MESSAGE };
