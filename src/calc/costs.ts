import type { CostCurve, ResourceBundle, Resource } from './types';

/**
 * Cost of buying levels `from+1 .. to`, in closed form.
 *
 * The sheet spells these out as SUMPRODUCT over ROW(INDIRECT(...)) ranges,
 * which is O(levels). Closed form keeps a goal-seek affordable. The two forms
 * differ in the last few float bits from a running sum, so tests compare with
 * relative tolerance.
 */
export function curveCost(curve: CostCurve, from: number, to: number): number {
  const n = to - from;
  if (n <= 0) return 0;

  if (curve.kind === 'geometric') {
    const { base, ratio } = curve;
    // sum_{i=from+1..to} base * ratio^(i-1)
    if (ratio === 1) return base * n;
    return (base * ratio ** from * (ratio ** n - 1)) / (ratio - 1);
  }

  // sum_{i=from+1..to} first + (i-1) * step
  const { first, step } = curve;
  return n * first + (step * n * (from + to - 1)) / 2;
}

/** Sum the tier bundles for levels `from+1 .. to`. */
export function tieredCost(
  tiers: readonly ResourceBundle[],
  from: number,
  to: number,
): ResourceBundle {
  const out: ResourceBundle = {};
  for (let i = from; i < to && i < tiers.length; i += 1) {
    const tier = tiers[i];
    if (!tier) continue;
    for (const [resource, amount] of Object.entries(tier) as [Resource, number][]) {
      out[resource] = (out[resource] ?? 0) + amount;
    }
  }
  return out;
}

/** Add `src` into `dst` in place. */
export function addBundle(dst: Partial<Record<Resource, number>>, src: ResourceBundle): void {
  for (const [resource, amount] of Object.entries(src) as [Resource, number][]) {
    dst[resource] = (dst[resource] ?? 0) + amount;
  }
}
