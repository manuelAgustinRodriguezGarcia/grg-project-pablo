import { NextResponse } from "next/server";

export function binaryFileResponse(
  body: Uint8Array | Buffer,
  filename: string,
  contentType: string,
  disposition: "inline" | "attachment" = "inline",
): NextResponse {
  const encoded = encodeURIComponent(filename);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_");
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  const payload = Uint8Array.from(bytes);

  return new NextResponse(payload, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
      "Content-Length": String(payload.byteLength),
    },
  });
}
