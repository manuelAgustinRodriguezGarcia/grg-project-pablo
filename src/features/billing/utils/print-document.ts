const PRINT_RENDER_SCALE = 2;

type PdfJsModule = typeof import("pdfjs-dist");

let pdfJsModule: PdfJsModule | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  // pdfjs-dist reads browser globals when the module loads, so it cannot be imported during SSR.
  if (!pdfJsModule) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfJsModule = pdfjs;
  }

  return pdfJsModule;
}

function toPrintError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return new Error(error.message);
  }

  return new Error("No se pudo abrir la impresión.");
}

function waitForImages(doc: Document): Promise<void> {
  const pending = [...doc.images].filter((image) => !image.complete);

  if (pending.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Impresión";
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "210mm";
    frame.style.height = "297mm";
    frame.style.border = "0";
    document.body.append(frame);

    const win = frame.contentWindow;
    const doc = frame.contentDocument;

    if (!win || !doc) {
      frame.remove();
      reject(new Error("No se pudo preparar la impresión."));
      return;
    }

    let settled = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      frame.remove();

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    doc.open();
    doc.write(html);
    doc.close();

    let printed = false;
    win.addEventListener(
      "afterprint",
      () => {
        printed = true;
        finish();
      },
      { once: true },
    );

    void waitForImages(doc)
      .then(() => {
        win.focus();
        win.print();
        if (!printed) {
          finish();
        }
      })
      .catch((error: unknown) => {
        finish(toPrintError(error));
      });
  });
}

async function renderPdfPages(blob: Blob): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const imageUrls: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PRINT_RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvas,
        viewport,
        intent: "print",
      }).promise;

      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error("No se pudo preparar el PDF para imprimir."));
            return;
          }

          resolve(result);
        }, "image/png");
      });
      imageUrls.push(URL.createObjectURL(imageBlob));
    }
  } finally {
    await loadingTask.destroy();
  }

  if (imageUrls.length === 0) {
    throw new Error("No se pudo preparar el PDF para imprimir.");
  }

  return imageUrls;
}

export async function printPdfBlob(blob: Blob): Promise<void> {
  const imageUrls = await renderPdfPages(blob);
  const images = imageUrls
    .map((url) => `<img alt="" src="${url}" />`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Imprimir</title>
    <style>
      @page { margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      img { display: block; width: 100%; height: auto; break-after: page; page-break-after: always; }
      img:last-child { break-after: auto; page-break-after: auto; }
    </style>
  </head><body>${images}</body></html>`;

  try {
    await printHtmlDocument(html);
  } finally {
    for (const url of imageUrls) {
      URL.revokeObjectURL(url);
    }
  }
}
