import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBillingSuccessShortcuts } from "./useBillingModalKeyboard";

afterEach(() => {
  cleanup();
});

function Harness({
  onPrint,
  onDownload,
  onCreateNew,
}: {
  onPrint?: () => void;
  onDownload?: () => void;
  onCreateNew?: () => void;
}) {
  useBillingSuccessShortcuts({ onPrint, onDownload, onCreateNew }, true);
  return <div>ok</div>;
}

describe("useBillingSuccessShortcuts", () => {
  it("no dispara descargar ni compartir si no hay handlers", () => {
    const onPrint = vi.fn();

    render(<Harness onPrint={onPrint} />);

    fireEvent.keyDown(document, { key: "D" });
    fireEvent.keyDown(document, { key: "C" });
    fireEvent.keyDown(document, { key: "I" });

    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("F2 crea nueva factura e I imprime", () => {
    const onPrint = vi.fn();
    const onCreateNew = vi.fn();

    render(<Harness onPrint={onPrint} onCreateNew={onCreateNew} />);

    fireEvent.keyDown(document, { key: "F2" });
    fireEvent.keyDown(document, { key: "I", code: "KeyI" });
    fireEvent.keyDown(document, { key: "N" });

    expect(onCreateNew).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledTimes(1);
  });
});
