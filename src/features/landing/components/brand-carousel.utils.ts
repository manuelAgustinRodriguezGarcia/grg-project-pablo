import type { Brand } from "../data/landingData";

const REFERENCE_SEGMENT_WEIGHT = 44;
const REFERENCE_DURATION_SEC = 110;

function getBrandWeight(brand: Brand): number {
  if (brand.logoSrc) {
    return 1;
  }

  return Math.max(1.5, brand.name.length / 10);
}

export function getSegmentWeight(brands: readonly Brand[]): number {
  return brands.reduce((total, brand) => total + getBrandWeight(brand), 0);
}

export function getScrollDurationSec(
  brands: readonly Brand[],
  segmentRepeats: number,
): number {
  const segmentWeight = getSegmentWeight(brands) * segmentRepeats;
  return (segmentWeight / REFERENCE_SEGMENT_WEIGHT) * REFERENCE_DURATION_SEC;
}

export function getSegmentRepeats(brandCount: number): number {
  return Math.max(4, Math.ceil(56 / brandCount));
}

/** Repite el set para llenar pantallas anchas; luego duplica para loop -50%. */
export function buildSeamlessLoop(
  brands: readonly Brand[],
  segmentRepeats: number,
): Brand[] {
  const segment = Array.from({ length: segmentRepeats }, () => brands).flat();
  return [...segment, ...segment];
}
