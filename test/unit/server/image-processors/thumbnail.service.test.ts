import { describe, expect, it } from "vitest";
import { validateImageBuffer } from "@/server/image-processors/image-integrity";
import { generateThumbnail } from "@/server/image-processors/thumbnail.service";
import { PNG_1X1_BUFFER } from "../../../fixtures/images/png-1x1";

describe("image-processors", () => {
  it("valida un buffer PNG válido", async () => {
    const result = await validateImageBuffer(PNG_1X1_BUFFER);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.mimeType).toBe("image/png");
    }
  });

  it("rechaza buffers corruptos", async () => {
    const result = await validateImageBuffer(Buffer.from("not-an-image"));
    expect(result.valid).toBe(false);
  });

  it("genera miniatura webp", async () => {
    const { thumbnailBuffer, mimeType } = await generateThumbnail(PNG_1X1_BUFFER);
    expect(thumbnailBuffer.byteLength).toBeGreaterThan(0);
    expect(mimeType).toBe("image/webp");
  });
});
