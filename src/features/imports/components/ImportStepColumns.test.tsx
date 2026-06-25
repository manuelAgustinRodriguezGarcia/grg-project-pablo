import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportStepColumns } from "@/features/imports/components/ImportStepColumns";

vi.mock("./ImportWizard.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

vi.mock("@/features/imports/components/ImportSearchableSelect", () => ({
  ImportSearchableSelect: ({
    disabled,
    value,
  }: {
    disabled?: boolean;
    value: string;
  }) => (
    <input
      role="combobox"
      aria-label="Código para vincular imágenes del ZIP"
      disabled={disabled}
      value={value}
      readOnly
    />
  ),
}));

vi.mock("@/features/imports/components/ImportYesNoRadio", () => ({
  ImportYesNoRadio: () => <div data-testid="yes-no-radio" />,
}));

const HEADERS = [
  { originalName: "NÚMERO DE ORDEN", internalKey: "numero_de_orden", columnIndex: 0 },
  { originalName: "Detalle", internalKey: "detalle", columnIndex: 1 },
];

describe("ImportStepColumns", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra el selector de código ZIP cuando hay ZIP adjunto", () => {
    render(
      <ImportStepColumns
        headers={HEADERS}
        folderColumns={[]}
        mappingRows={[
          {
            headerInternalKey: "numero_de_orden",
            headerOriginalName: "NÚMERO DE ORDEN",
            targetValue: "__create__",
          },
        ]}
        primaryCodeHeaderKey="numero_de_orden"
        showPrimaryCodeSelection
        disabled={false}
        onMappingRowsChange={vi.fn()}
        onPrimaryCodeHeaderKeyChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/vinculará las imágenes del archivo zip/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "Generar Códigos" })).not.toBeInTheDocument();
  });

  it("oculta la selección de código ZIP cuando no hay ZIP adjunto", () => {
    render(
      <ImportStepColumns
        headers={HEADERS}
        folderColumns={[]}
        mappingRows={[
          {
            headerInternalKey: "numero_de_orden",
            headerOriginalName: "NÚMERO DE ORDEN",
            targetValue: "__create__",
          },
        ]}
        primaryCodeHeaderKey="numero_de_orden"
        showPrimaryCodeSelection={false}
        disabled={false}
        onMappingRowsChange={vi.fn()}
        onPrimaryCodeHeaderKeyChange={vi.fn()}
      />,
    );

    expect(screen.queryByText(/vincular imágenes del zip/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar Códigos" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Columna Excel" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Crear columna nueva" }),
    ).toBeInTheDocument();
  });
});
