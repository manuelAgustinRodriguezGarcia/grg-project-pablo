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
});
