import "server-only";
import QRCode from "qrcode";

const QR_PIXELS = 256;

export async function renderArcaQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: QR_PIXELS,
  });
}
