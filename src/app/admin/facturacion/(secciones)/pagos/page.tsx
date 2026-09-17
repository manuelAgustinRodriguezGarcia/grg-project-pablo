import { redirect } from "next/navigation";

export default function FacturacionPagosRedirectPage() {
  redirect("/admin/facturacion/movimientos");
}
