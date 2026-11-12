import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminQueryKeys } from "@/features/admin/query-keys";
import {
  downloadLibroIvaPdf,
  downloadLibroIvaXlsx,
} from "@/features/billing/utils/invoice-pdf-client";
import { LibroIvaDialog } from "./LibroIvaDialog";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/billing/utils/invoice-pdf-client", () => ({
  downloadLibroIvaCustomPdf: vi.fn(),
  downloadLibroIvaCustomXlsx: vi.fn(),
  downloadLibroIvaPdf: vi.fn(),
  downloadLibroIvaXlsx: vi.fn(),
  printLibroIvaCustomPdf: vi.fn(),
  printLibroIvaPdf: vi.fn(),
}));

vi.mock("@/features/billing/styles/ClientsManager.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

vi.mock("@/features/prices/styles/PriceColumnEditModal.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

afterEach(() => {
  cleanup();
});

const ARCHIVE_ID = `c${"a".repeat(24)}`;

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(adminQueryKeys.billingLibroIvaArchives("PRODUCCION"), []);
  queryClient.setQueryData(
    adminQueryKeys.billingLibroIvaArchiveDetails("PRODUCCION", [ARCHIVE_ID]),
    {},
  );
  render(
    <QueryClientProvider client={queryClient}>
      <LibroIvaDialog onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("LibroIvaDialog resúmenes", () => {
  it("genera el libro sin un acceso a resúmenes en el modal", () => {
    renderDialog();

    expect(screen.queryByRole("link", { name: "Ver resúmenes archivados" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Excel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Imprimir" })).toBeEnabled();
  });

  it("olvida la lista de Libros después de descargar un libro mensual", async () => {
    vi.mocked(downloadLibroIvaPdf).mockResolvedValue(undefined);
    const queryClient = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));

    await waitFor(() => {
      expect(queryClient.getQueryData(adminQueryKeys.billingLibroIvaArchives("PRODUCCION"))).toBeUndefined();
    });
    expect(
      queryClient.getQueryData(
        adminQueryKeys.billingLibroIvaArchiveDetails("PRODUCCION", [ARCHIVE_ID]),
      ),
    ).toBeUndefined();
  });

  it("conserva la lista si la descarga mensual falla", async () => {
    vi.mocked(downloadLibroIvaXlsx).mockRejectedValue(new Error("No se pudo generar el Libro IVA."));
    const queryClient = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Excel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo generar el Libro IVA.");
    expect(queryClient.getQueryData(adminQueryKeys.billingLibroIvaArchives("PRODUCCION"))).toEqual([]);
  });

  it("no toca la lista al descargar un informe diario", async () => {
    vi.mocked(downloadLibroIvaPdf).mockReset();
    vi.mocked(downloadLibroIvaPdf).mockResolvedValue(undefined);
    const queryClient = renderDialog();

    fireEvent.click(screen.getByRole("radio", { name: "Diario" }));
    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));

    await waitFor(() => expect(downloadLibroIvaPdf).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(adminQueryKeys.billingLibroIvaArchives("PRODUCCION"))).toEqual([]);
  });
});
