import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportYesNoRadio } from "./ImportYesNoRadio";

vi.mock("./ImportWizard.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

describe("ImportYesNoRadio", () => {
  afterEach(() => {
    cleanup();
  });

  it("cambia entre Sí y No", () => {
    const onChange = vi.fn();

    render(
      <ImportYesNoRadio name="test" value={true} onChange={onChange} />,
    );

    fireEvent.click(screen.getByLabelText("No"));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
