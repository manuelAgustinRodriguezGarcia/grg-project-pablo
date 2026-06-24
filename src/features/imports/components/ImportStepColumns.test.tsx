import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
      aria-label="Columna código principal"
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

  it("deshabilita el selector y activa el toggle al usar códigos generados", () => {
    const onUseGeneratedPrimaryCodesChange = vi.fn();

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
          {
            headerInternalKey: "detalle",
            headerOriginalName: "Detalle",
            targetValue: "__create__",
          },
        ]}
        primaryCodeHeaderKey="numero_de_orden"
        useGeneratedPrimaryCodes
        disabled={false}
        onMappingRowsChange={vi.fn()}
        onPrimaryCodeHeaderKeyChange={vi.fn()}
        onUseGeneratedPrimaryCodesChange={onUseGeneratedPrimaryCodesChange}
      />,
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generar Códigos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText(/las imágenes se asociarán por otras columnas/i),
    ).toBeInTheDocument();
  });

  it("activa el modo generado al pulsar el botón", () => {
    const onUseGeneratedPrimaryCodesChange = vi.fn();

    render(
      <ImportStepColumns
        headers={HEADERS}
        folderColumns={[]}
        mappingRows={[]}
        primaryCodeHeaderKey="numero_de_orden"
        useGeneratedPrimaryCodes={false}
        disabled={false}
        onMappingRowsChange={vi.fn()}
        onPrimaryCodeHeaderKeyChange={vi.fn()}
        onUseGeneratedPrimaryCodesChange={onUseGeneratedPrimaryCodesChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generar Códigos" }));

    expect(onUseGeneratedPrimaryCodesChange).toHaveBeenCalledWith(true);
  });
});
