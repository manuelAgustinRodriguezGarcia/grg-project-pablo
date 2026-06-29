import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogPageIntro } from "./CatalogPageChrome";

afterEach(() => {
  cleanup();
});

describe("CatalogPageIntro", () => {
  it("calls onImportExcelClick when the import card is clicked", () => {
    const onImportExcelClick = vi.fn();

    render(<CatalogPageIntro onImportExcelClick={onImportExcelClick} />);

    fireEvent.click(screen.getByTestId("catalog-action-import-excel"));

    expect(onImportExcelClick).toHaveBeenCalledTimes(1);
  });

  it("calls onAddProductClick when the add product card is clicked", () => {
    const onAddProductClick = vi.fn();

    render(<CatalogPageIntro onAddProductClick={onAddProductClick} />);

    fireEvent.click(screen.getByTestId("catalog-action-add-product"));

    expect(onAddProductClick).toHaveBeenCalledTimes(1);
  });
});
