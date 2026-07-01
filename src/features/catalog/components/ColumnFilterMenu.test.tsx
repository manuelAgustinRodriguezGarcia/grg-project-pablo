import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColumnFilterMenu } from "@/features/catalog/components/ColumnFilterMenu";
import type { ColumnListItem } from "@/features/catalog/types/column.types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

describe("ColumnFilterMenu", () => {
  it("aplica el filtro tras 2.5s sin teclear", () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    const column = createColumn();

    render(
      <ColumnFilterMenu column={column} onFilterChange={onFilterChange} />,
    );

    act(() => {
      fireEvent.click(screen.getByLabelText("Filtrar columna ANCLAJE FRENTE"));
    });

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
    const column = createColumn();

    render(
      <ColumnFilterMenu column={column} onFilterChange={onFilterChange} />,
    );

    act(() => {
      fireEvent.click(screen.getByLabelText("Filtrar columna ANCLAJE FRENTE"));
    });

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
    const column = createColumn();

    render(
      <ColumnFilterMenu column={column} onFilterChange={onFilterChange} />,
    );

    act(() => {
      fireEvent.click(screen.getByLabelText("Filtrar columna ANCLAJE FRENTE"));
    });

    act(() => {
      fireEvent.change(screen.getByLabelText("Valor de filtro para ANCLAJE FRENTE"), {
        target: { value: "indiel" },
      });
    });

    act(() => {
      fireEvent.click(screen.getByLabelText("Filtrar columna ANCLAJE FRENTE"));
    });

    expect(onFilterChange).toHaveBeenCalledWith({
      columnInternalKey: "anclaje_frente",
      operator: "contains",
      value: "indiel",
    });
  });
});
