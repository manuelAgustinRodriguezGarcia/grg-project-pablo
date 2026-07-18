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
  ImportYesNoRadio: ({
    name,
    value,
    onChange,
  }: {
    name: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <div data-testid={`yes-no-radio-${name}`}>
      <button type="button" onClick={() => onChange(true)}>
        Sí
      </button>
      <button type="button" onClick={() => onChange(false)}>
        No
      </button>
      <span data-testid={`yes-no-value-${name}`}>{value ? "yes" : "no"}</span>
    </div>
  ),
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
    expect(screen.getByText("SELECCIONAR TODAS")).toBeInTheDocument();
  });

  it("permite seleccionar o deseleccionar todas las columnas", async () => {
    const onMappingRowsChange = vi.fn();
    const mappingRows = [
      {
        headerInternalKey: "numero_de_orden",
        headerOriginalName: "NÚMERO DE ORDEN",
        targetValue: "__create__",
      },
      {
        headerInternalKey: "detalle",
        headerOriginalName: "Detalle",
        targetValue: "__create__",
      },
    ];

    render(
      <ImportStepColumns
        headers={HEADERS}
        folderColumns={[]}
        mappingRows={mappingRows}
        primaryCodeHeaderKey="numero_de_orden"
        showPrimaryCodeSelection={false}
        disabled={false}
        onMappingRowsChange={onMappingRowsChange}
        onPrimaryCodeHeaderKeyChange={vi.fn()}
      />,
    );

    const selectAllGroup = screen.getByTestId("yes-no-radio-create-column-select-all");
    expect(screen.getByTestId("yes-no-value-create-column-select-all")).toHaveTextContent(
      "yes",
    );

    selectAllGroup.querySelectorAll("button")[1]?.click();

    expect(onMappingRowsChange).toHaveBeenCalledWith([
      {
        headerInternalKey: "numero_de_orden",
        headerOriginalName: "NÚMERO DE ORDEN",
        targetValue: "__ignore__",
      },
      {
        headerInternalKey: "detalle",
        headerOriginalName: "Detalle",
        targetValue: "__ignore__",
      },
    ]);
  });
});
