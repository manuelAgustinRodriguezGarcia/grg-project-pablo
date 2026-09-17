export const DASHBOARD_BLUE_SCALE = [
  "#031b3d",
  "#062b5f",
  "#0d4a8a",
  "#0066d9",
  "#4a96dc",
] as const;

export function getBlueScaleColor(rank: number, total: number): string {
  if (total <= 1) {
    return DASHBOARD_BLUE_SCALE[0];
  }

  const paletteIndex = Math.round(
    (rank / (total - 1)) * (DASHBOARD_BLUE_SCALE.length - 1),
  );

  return DASHBOARD_BLUE_SCALE[paletteIndex];
}

export function getBlueScaleColorsByAmount<T extends { amount: number }>(
  items: readonly T[],
): string[] {
  const rankedIndices = items
    .map((item, index) => ({ index, amount: item.amount }))
    .sort((left, right) => right.amount - left.amount)
    .map((entry) => entry.index);

  const colors = new Array<string>(items.length);

  rankedIndices.forEach((originalIndex, rank) => {
    colors[originalIndex] = getBlueScaleColor(rank, items.length);
  });

  return colors;
}

export const DASHBOARD_GREEN_SCALE = [
  "#0f3d28",
  "#1a5c42",
  "#2d7a5a",
  "#6fa889",
  "#c8e0d4",
] as const;

export function getGreenScaleColor(rank: number, total: number): string {
  if (total <= 1) {
    return DASHBOARD_GREEN_SCALE[0];
  }

  const paletteIndex = Math.round(
    (rank / (total - 1)) * (DASHBOARD_GREEN_SCALE.length - 1),
  );

  return DASHBOARD_GREEN_SCALE[paletteIndex];
}
