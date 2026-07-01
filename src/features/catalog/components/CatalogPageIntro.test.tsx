import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogPageIntro } from "./CatalogPageChrome";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CatalogPageIntro", () => {
  it("calls onImportExcelClick when the import card is clicked", () => {
    const onImportExcelClick = vi.fn();

    render(
      <CatalogPageIntro
        onDebouncedSearchChange={vi.fn()}
        onImportExcelClick={onImportExcelClick}
      />,
    );

    fireEvent.click(screen.getByTestId("catalog-action-import-excel"));

    expect(onImportExcelClick).toHaveBeenCalledTimes(1);
  });

  it("calls onAddProductClick when the add product card is clicked", () => {
    const onAddProductClick = vi.fn();

    render(
      <CatalogPageIntro
        onDebouncedSearchChange={vi.fn()}
        onAddProductClick={onAddProductClick}
      />,
    );

    fireEvent.click(screen.getByTestId("catalog-action-add-product"));

    expect(onAddProductClick).toHaveBeenCalledTimes(1);
  });

  it("debounces search input before notifying the parent", () => {
    vi.useFakeTimers();
    const onDebouncedSearchChange = vi.fn();

    render(<CatalogPageIntro onDebouncedSearchChange={onDebouncedSearchChange} />);

    act(() => {
      fireEvent.change(screen.getByLabelText("Búsqueda global"), {
        target: { value: "abc" },
      });
    });

    expect(onDebouncedSearchChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onDebouncedSearchChange).toHaveBeenCalledWith("abc");
  });

  it("clears search input with Escape and the clear button", () => {
    vi.useFakeTimers();
    const onDebouncedSearchChange = vi.fn();

    render(<CatalogPageIntro onDebouncedSearchChange={onDebouncedSearchChange} />);

    const input = screen.getByLabelText("Búsqueda global");

    act(() => {
      fireEvent.change(input, { target: { value: "filtro" } });
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(input).toHaveValue("");

    act(() => {
      fireEvent.change(input, { target: { value: "otro" } });
      fireEvent.click(screen.getByLabelText("Limpiar búsqueda"));
    });

    expect(input).toHaveValue("");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onDebouncedSearchChange).toHaveBeenLastCalledWith("");
  });

  it("resets search input when searchResetKey changes", () => {
    const onDebouncedSearchChange = vi.fn();
    const { rerender } = render(
      <CatalogPageIntro
        onDebouncedSearchChange={onDebouncedSearchChange}
        searchResetKey={0}
      />,
    );

    const input = screen.getByLabelText("Búsqueda global");
    fireEvent.change(input, { target: { value: "persistente" } });
    expect(input).toHaveValue("persistente");

    rerender(
      <CatalogPageIntro
        onDebouncedSearchChange={onDebouncedSearchChange}
        searchResetKey={1}
      />,
    );

    expect(input).toHaveValue("");
  });
});
