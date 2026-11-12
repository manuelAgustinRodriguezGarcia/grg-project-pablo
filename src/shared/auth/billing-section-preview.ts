/**
 * Vista previa de Estadísticas y Libros de IVA.
 * El resto de los usuarios no ve esas secciones hasta que se retire esta lista.
 */
const BILLING_SECTION_PREVIEW_EMAILS = [
  "agencygrg@gmail.com",
  "visitagrg@gmail.com",
] as const;

export function canPreviewBillingSections(
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  return (BILLING_SECTION_PREVIEW_EMAILS as readonly string[]).includes(normalized);
}
