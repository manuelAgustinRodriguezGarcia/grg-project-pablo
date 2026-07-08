import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/catalog/actions/column.actions", () => ({
  updateColumnAction: vi.fn(),
  setColumnVisibilityAction: vi.fn(),
}));

vi.mock("@/features/catalog/actions/column-help.actions", () => ({
  deleteColumnHelpImageAction: vi.fn(),
}));

import { ColumnFilterMenu } from "@/features/catalog/components/ColumnFilterMenu";
import type { ColumnListItem } from "@/features/catalog/types/column.types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 100,
    y: 50,
    top: 50,
    left: 100,
    right: 220,
    bottom: 90,
    width: 120,
    height: 40,
    toJSON: () => ({}),
  }));
});

function createColumn(overrides: Partial<ColumnListItem> = {}): ColumnListItem {
  return {
    id: "col-1",
    folderId: "folder-1",
    originalName: "Anclaje frente",
    displayName: "ANCLAJE FRENTE",
    internalKey: "anclaje_frente",
    dataType: "TEXT",
    order: 0,
    visibleToNormalUser: true,
    isSearchable: true,
    isGloballySearchable: false,
    isFilterable: true,
    isGloballyFilterable: false,
    isAdminEditable: true,
    isPrimaryCode: false,
    isEquivalence: false,
    isDescription: false,
    isImageCode: false,
    isRequired: false,
    isReadOnly: false,
    width: null,
    format: null,
    unit: null,
    label: null,
    globalFieldKey: null,
    helpText: null,
    helpImageAltText: null,
    hasContextualHelp: false,
    helpImagePreviewUrl: null,
    helpImageFullUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderOpenMenu(onFilterChange = vi.fn(), onOpenChange = vi.fn()) {
  const anchorRef = createRef<HTMLTableCellElement>();

  render(
    <>
      <table>
        <thead>
          <tr>
            <th ref={anchorRef}>ANCLAJE FRENTE</th>
          </tr>
        </thead>
      </table>
      <ColumnFilterMenu
        column={createColumn()}
        onFilterChange={onFilterChange}
        isOpen
        onOpenChange={onOpenChange}
        anchorRef={anchorRef}
      />
    </>,
  );

  return { anchorRef };
}

describe("ColumnFilterMenu", () => {
  it("aplica el filtro tras 2.5s sin teclear", () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();

    renderOpenMenu(onFilterChange);

    act(() => {
      fireEvent.change(screen.getByLabelText("Valor de filtro para ANCLAJE FRENTE"), {
        target: { value: "indiel" },
      });
    });

    expect(onFilterChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onFilterChange).toHaveBeenCalledWith({
      columnInternalKey: "anclaje_frente",
      operator: "contains",
      value: "indiel",
    });
  });

  it("aplica el filtro de inmediato al presionar Enter", () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();

    renderOpenMenu(onFilterChange);

    const input = screen.getByLabelText("Valor de filtro para ANCLAJE FRENTE");

    act(() => {
      fireEvent.change(input, { target: { value: "indiel" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onFilterChange).toHaveBeenCalledWith({
      columnInternalKey: "anclaje_frente",
      operator: "contains",
      value: "indiel",
    });

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
  });

  it("aplica el filtro al cerrar el menú antes del debounce", () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    const onOpenChange = vi.fn();
    const anchorRef = createRef<HTMLTableCellElement>();

    const { rerender } = render(
      <>
        <table>
          <thead>
            <tr>
              <th ref={anchorRef}>ANCLAJE FRENTE</th>
            </tr>
          </thead>
        </table>
        <ColumnFilterMenu
          column={createColumn()}
          onFilterChange={onFilterChange}
          isOpen
          onOpenChange={onOpenChange}
          anchorRef={anchorRef}
        />
      </>,
    );

    act(() => {
      fireEvent.change(screen.getByLabelText("Valor de filtro para ANCLAJE FRENTE"), {
        target: { value: "indiel" },
      });
    });

    rerender(
      <>
        <table>
          <thead>
            <tr>
              <th ref={anchorRef}>ANCLAJE FRENTE</th>
            </tr>
          </thead>
        </table>
        <ColumnFilterMenu
          column={createColumn()}
          onFilterChange={onFilterChange}
          isOpen={false}
          onOpenChange={onOpenChange}
          anchorRef={anchorRef}
        />
      </>,
    );

    expect(onFilterChange).toHaveBeenCalledWith({
      columnInternalKey: "anclaje_frente",
      operator: "contains",
      value: "indiel",
    });
  });

  it("cierra el menú al presionar el botón X", () => {
    const onOpenChange = vi.fn();

    renderOpenMenu(vi.fn(), onOpenChange);

    fireEvent.click(screen.getByLabelText("Cerrar filtro"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("muestra solo ocultar/mostrar en columnas de código imagen", () => {
    const onOpenChange = vi.fn();
    const anchorRef = createRef<HTMLTableCellElement>();

    render(
      <>
        <table>
          <thead>
            <tr>
              <th ref={anchorRef}>CÓDIGO IMAGEN</th>
            </tr>
          </thead>
        </table>
        <ColumnFilterMenu
          column={createColumn({
            originalName: "Código imagen",
            displayName: "CÓDIGO IMAGEN",
            internalKey: "codigo_imagen",
            isImageCode: true,
          })}
          isOpen
          onOpenChange={onOpenChange}
          anchorRef={anchorRef}
          mode="visibility-only"
          onColumnsChanged={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole("dialog", { name: "Opciones de CÓDIGO IMAGEN" })).toBeInTheDocument();
    expect(screen.getByText("Opciones de columna")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar columna" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Valor de filtro/)).not.toBeInTheDocument();
    expect(screen.queryByText("Editar columna")).not.toBeInTheDocument();
  });

  it("no vuelve a aplicar el filtro cuando el padre lo limpia externamente", () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    const column = createColumn();
    const activeFilter = {
      columnInternalKey: "anclaje_frente",
      operator: "contains" as const,
      value: "indiel",
    };
    const anchorRef = createRef<HTMLTableCellElement>();

    const { rerender } = render(
      <ColumnFilterMenu
        column={column}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        isOpen={false}
        onOpenChange={vi.fn()}
        anchorRef={anchorRef}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    onFilterChange.mockClear();

    rerender(
      <ColumnFilterMenu
        column={column}
        onFilterChange={onFilterChange}
        isOpen={false}
        onOpenChange={vi.fn()}
        anchorRef={anchorRef}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onFilterChange).not.toHaveBeenCalled();
  });
});
