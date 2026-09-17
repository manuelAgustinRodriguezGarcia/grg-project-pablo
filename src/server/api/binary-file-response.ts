import { NextResponse } from "next/server";

export function binaryFileResponse(
  body: Uint8Array | Buffer,
  filename: string,
  contentType: string,
  disposition: "inline" | "attachment" = "inline",
): NextResponse {
  const encoded = encodeURIComponent(filename);

  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}
