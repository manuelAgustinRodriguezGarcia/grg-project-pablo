import sharp from "sharp";

const THUMB_MAX_WIDTH = 256;

export type ThumbnailResult = {
  thumbnailBuffer: Buffer;
  mimeType: string;
};

export async function generateThumbnail(buffer: Buffer): Promise<ThumbnailResult> {
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
