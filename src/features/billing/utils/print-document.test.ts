import { afterEach, describe, expect, it, vi } from "vitest";
import { printHtmlDocument } from "@/features/billing/utils/print-document";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("printHtmlDocument", () => {
  it("imprime el html en un frame del mismo origen", async () => {
    const printed: string[] = [];
    const originalAppend = document.body.append.bind(document.body);

    vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
      const result = originalAppend(...nodes);
      const frame = nodes.find(
        (node): node is HTMLIFrameElement => node instanceof HTMLIFrameElement,
      );

      if (frame?.contentWindow) {
        frame.contentWindow.print = () => {
          printed.push(frame.contentDocument?.body.innerHTML ?? "");
          frame.contentWindow?.dispatchEvent(new Event("afterprint"));
        };
      }

      return result;
    });

    await printHtmlDocument(
      "<!doctype html><html><body><h1>Clientes con deuda</h1></body></html>",
    );

    expect(printed).toEqual(["<h1>Clientes con deuda</h1>"]);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("rechaza si el navegador bloquea print y no deja el frame colgado", async () => {
    const originalAppend = document.body.append.bind(document.body);

    vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
      const result = originalAppend(...nodes);
      const frame = nodes.find(
        (node): node is HTMLIFrameElement => node instanceof HTMLIFrameElement,
      );

      if (frame?.contentWindow) {
        frame.contentWindow.print = () => {
          throw new DOMException(
            "Blocked a frame from accessing a cross-origin frame.",
            "SecurityError",
          );
        };
      }

      return result;
    });

    await expect(
      printHtmlDocument("<!doctype html><html><body><p>Factura</p></body></html>"),
    ).rejects.toThrow(/cross-origin/);

    expect(document.querySelector("iframe")).toBeNull();
  });
});
