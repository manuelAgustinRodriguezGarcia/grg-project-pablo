import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogPageIntro } from "./CatalogPageChrome";

describe("CatalogPageIntro", () => {
  it("calls onImportExcelClick when the import card is clicked", () => {
    const onImportExcelClick = vi.fn();

    render(<CatalogPageIntro onImportExcelClick={onImportExcelClick} />);

    fireEvent.click(screen.getByTestId("catalog-action-import-excel"));

    expect(onImportExcelClick).toHaveBeenCalledTimes(1);
  });
});
