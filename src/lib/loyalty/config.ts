/** 100 points = £1 off. One place both checkout and display logic read from. */
export const POINTS_PER_POUND = 100;

export function pointsToPounds(points: number): number {
  return Number((points / POINTS_PER_POUND).toFixed(2));
}

export function poundsToPoints(pounds: number): number {
  return Math.floor(pounds * POINTS_PER_POUND);
}

/** 1 point earned per £1 spent, on a successfully paid amount. */
export function pointsEarnedForPayment(amount: number): number {
  return Math.floor(amount);
}
