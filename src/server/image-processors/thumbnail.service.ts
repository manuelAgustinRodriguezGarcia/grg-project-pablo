import { loadSharp } from "./load-sharp";

const THUMB_MAX_WIDTH = 256;

export type ThumbnailResult = {
  thumbnailBuffer: Buffer;
  mimeType: string;
};

export async function generateThumbnail(buffer: Buffer): Promise<ThumbnailResult> {
  const sharp = await loadSharp();
  const thumbnailBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return {
    thumbnailBuffer,
    mimeType: "image/webp",
  };
}
