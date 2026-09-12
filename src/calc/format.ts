/**
 * Number formatting, matching the workbook's short-scale display.
 *
 * The sheet implements this as a 40-line INDEX/MATCH/TEXT expression repeated
 * in every D-column cell; this is the same behaviour, minus Excel's artefact of
 * leaving a trailing "." when the "0.##" branch rounds to a whole number.
 */

import type { Resource } from './types';

const SCALE_NAMES = [
  '',
  'Thousand',
  'Million',
  'Billion',
  'Trillion',
  'Quadrillion',
  'Quintillion',
  'Sextillion',
  'Septillion',
  'Octillion',
  'Nonillion',
  'Decillion',
  'Undecillion',
  'Duodecillion',
  'Tredecillion',
  'Quattuordecillion',
  'Quindecillion',
  'Sexdecillion',
  'Septendecillion',
  'Octodecillion',
  'Novemdecillion',
  'Vigintillion',
] as const;

/** Compact suffixes for tight table cells. */
const SHORT_SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
  'TDc',
  'QaDc',
  'QiDc',
  'SxDc',
  'SpDc',
  'ODc',
  'NDc',
  'Vg',
] as const;

function scaleIndex(value: number): number {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs) || abs < 1000) return 0;
  const index = Math.floor(Math.log10(abs) / 3);
  return Math.min(Math.max(index, 0), SCALE_NAMES.length - 1);
}

function scaleAndRound(value: number, index: number): { text: string; scaled: number } {
  const scaled = value / 10 ** (index * 3);
  const rounded = Math.round(scaled * 100) / 100;
  // Whole numbers print without a decimal part, matching the sheet's "0" branch.
  const text = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return { text, scaled };
}

/** "1.73 Thousand", "386.29 Septillion" — the sheet's D-column style. */
export function formatShortScale(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '—';
  if (value === 0) return '0';

  const index = scaleIndex(value);
  const { text } = scaleAndRound(value, index);
  const name = SCALE_NAMES[index] ?? '';
  return name ? `${text} ${name}` : text;
}

/** "1.73K", "386.29Sp" — for dense table cells. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '—';
  if (value === 0) return '0';

  const index = scaleIndex(value);
  const { text } = scaleAndRound(value, index);
  return `${text}${SHORT_SUFFIXES[index] ?? ''}`;
}

/*
 * Orb prices are whole numbers.
 *
 * The cost curves are geometric, so they land on values like 366.05 that the
 * game itself would never quote — you cannot hold a twentieth of an orb. The
 * engine keeps the exact figure, because that is what the golden test asserts
 * and what the optimizer compares; only the display rounds, the same way the
 * Arcanist Stats damage readout does.
 *
 * Runes and essence are deliberately left alone: they arrive as fractional
 * per-hour rates, and rounding a rune price would imply a precision the
 * time-to-afford figures beside it do not have.
 */
const ORB_RESOURCES = new Set<Resource>([
  'whiteOrb',
  'greenOrb',
  'purpleOrb',
  'orangeOrb',
  'redOrb',
]);

export function isOrb(resource: Resource): boolean {
  return ORB_RESOURCES.has(resource);
}

/** A price, for a dense table cell. Orbs are whole; everything else is not. */
export function formatCost(resource: Resource, amount: number): string {
  return formatCompact(isOrb(resource) ? Math.round(amount) : amount);
}

/** The same rule, in the Total Resources panel's long-scale style. */
export function formatCostLong(resource: Resource, amount: number): string {
  return formatShortScale(isOrb(resource) ? Math.round(amount) : amount);
}

/** Plain decimal with a fixed number of significant-ish digits. */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '—';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  const pct = value * 100;
  const text = Number.isInteger(pct) ? pct.toString() : pct.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return `${text}%`;
}

export function formatEffect(value: number, display: 'flat' | 'percent'): string {
  if (value === 0) return display === 'percent' ? '+0%' : '+0';
  const sign = value > 0 ? '+' : '';
  return display === 'percent'
    ? `${sign}${formatPercent(value)}`
    : `${sign}${formatNumber(value)}`;
}

/**
 * Hours as "42m", "6h 10m", "9d 4h", "3mo 12d", "2y 4mo".
 *
 * Deliberately coarser as the span grows: a plan that runs for two years does
 * not become more useful by being precise to the minute, and the precision
 * would imply a confidence the estimate has not earned.
 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return 'never';
  if (hours <= 0) return 'now';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;

  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    // Rounding 1.999h up to "1h 60m" is the one case worth catching.
    return m === 60 ? `${h + 1}h` : m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 60) {
    const h = Math.floor(hours - days * 24);
    return h > 0 ? `${days}d ${h}h` : `${days}d`;
  }

  const months = Math.floor(days / 30);
  if (months < 24) {
    const d = days - months * 30;
    return d > 0 ? `${months}mo ${d}d` : `${months}mo`;
  }

  const years = Math.floor(months / 12);
  const mo = months - years * 12;
  return mo > 0 ? `${years}y ${mo}mo` : `${years}y`;
}

/** Seconds as "1m 24s" for durations and cycle times. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${formatNumber(seconds, 1)}s`;
  const mins = Math.floor(seconds / 60);
  const rest = seconds - mins * 60;
  return rest === 0 ? `${mins}m` : `${mins}m ${formatNumber(rest, 1)}s`;
}
