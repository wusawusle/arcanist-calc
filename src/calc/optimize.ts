/**
 * Upgrade ranking.
 *
 * The optimiser answers "what should I buy next", which is a different question
 * from "what is the best build". The best build is trivially every upgrade at
 * max — every lever here is monotone-positive and eventually affordable — so
 * searching the configuration space is pointless. What is not trivial is the
 * *order*, and that is what this module scores.
 *
 * Scoring is empirical rather than analytical: clone the input, add some levels,
 * run `compute` again, diff the outcome. Nothing here duplicates a formula from
 * the engine, so a balance patch to `constants.ts` moves the rankings without
 * touching this file. `compute` is pure and its costs are closed form, which is
 * what makes a few hundred recomputes per keystroke affordable.
 *
 * A step is not always one level. Several of the engine's outputs are quantised
 * — `hitsToMine` is a whole number of hits — so a single point of damage usually
 * buys nothing at all, and a one-level view reports every damage row as worth
 * exactly zero forever. What the player needs is the *cheapest purchase on that
 * row that actually does something*, which may be four levels. So each lever is
 * probed for the first few step sizes that move an objective, and the ranking
 * picks between them; see `breakpoints`.
 *
 * Two objectives are tracked, because the player has two:
 *
 *   essence/hr — sum of net essence across the three tiers
 *   runes/hr   — sum across altars that are actually unlocked and running
 *
 * They compete less than they appear to. In `computeAltars`, capacity and
 * cycle time appear in both `runesPerHour` and `essenceCostPerHour` and cancel,
 * so a single altar converts essence to runes at exactly
 * `(1 + 0.2*craft)(1 + card) * runeCraftMulti` no matter how it is tuned.
 * Only the altar throughput dials trade one objective against the other;
 * everything else either raises both or is neutral.
 *
 * That cancellation is per altar, not across the set: raising capacity on one
 * altar moves drain toward it, so a portfolio of altars with unequal craft
 * levels does shift its blended rate. Both facts are pinned in the tests.
 */

import { curveCost, tieredCost } from './costs';
import {
  ALTARS,
  ALTAR_IDS,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  SPELLS,
  SPELL_IDS,
} from './constants';
import { compute } from './engine';
import type {
  AltarId,
  ArcanistInput,
  ArcanistResult,
  EssenceType,
  Resource,
  ResourceBundle,
} from './types';
import { ESSENCE_TYPES } from './types';

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export type CandidateSection =
  | 'essence'
  | 'altar'
  | 'altarUnlock'
  | 'altarToggle'
  | 'spell'
  | 'exchange';

/**
 * One lever the player can pull, priced for any number of levels at once.
 *
 * `id` matches the corresponding `UpgradeCost.id` from the engine's `rows`, so
 * a ranking entry can be traced back to the row the UI already renders.
 */
export interface Lever {
  id: string;
  label: string;
  section: CandidateSection;
  level: number;
  max: number;
  /** False only for actions with no purchase price (for example starting an altar). */
  priced: boolean;
  /** Cost of going from `level` to `level + steps`. Empty when unpriced. */
  cost: (steps: number) => ResourceBundle;
  /** Mutates a draft input to buy `steps` more levels. */
  apply: (draft: ArcanistInput, steps: number) => void;
}

/** A lever at one chosen step size — the thing that actually gets scored. */
export interface Candidate {
  id: string;
  label: string;
  section: CandidateSection;
  level: number;
  max: number;
  /** How many levels this buys. One or more; never past `max`. */
  steps: number;
  /** The level this lands on, i.e. `level + steps`. */
  to: number;
  /** Unique across step sizes of the same lever, unlike `id`. */
  key: string;
  /** Cost of going from `level` to `to`. Empty when unpriced. */
  stepCost: ResourceBundle;
  priced: boolean;
  /** The single resource this step costs, when it is exactly one. */
  resource?: Resource;
  /** Mutates a draft input to buy this step. */
  apply: (draft: ArcanistInput) => void;
}

const clamp = (level: number, max: number) =>
  Number.isFinite(level) ? Math.max(0, Math.min(max, Math.floor(level))) : 0;

/** The single resource in a bundle, or undefined when it spans several. */
function soleResource(bundle: ResourceBundle): Resource | undefined {
  const keys = Object.keys(bundle) as Resource[];
  return keys.length === 1 ? keys[0] : undefined;
}

/**
 * Every lever that is not already maxed, in the order the UI lists them.
 *
 * Maxed rows are dropped rather than scored zero: a ranking is a list of things
 * you can do, and "buy another level of a maxed upgrade" is not one of them.
 */
export function enumerateLevers(input: ArcanistInput): Lever[] {
  const out: Lever[] = [];

  for (const def of ESSENCE_UPGRADES) {
    const level = clamp(input.essence[def.id], def.max);
    if (level >= def.max) continue;

    out.push({
      id: def.id,
      label: def.label,
      section: 'essence',
      level,
      max: def.max,
      priced: true,
      // A multi-level step across a tier boundary spans two resources, and is
      // handled the way altar unlocks are: ranked by gain, never by price.
      cost: (steps) =>
        def.cost.kind === 'tiered'
          ? tieredCost(def.cost.tiers, level, level + steps)
          : { [def.cost.resource]: curveCost(def.cost.curve, level, level + steps) },
      apply: (draft, steps) => {
        draft.essence[def.id] = level + steps;
      },
    });
  }

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];

    // The unlock gates everything else on the altar, so it is a lever in its
    // own right — and the only altar row whose cost spans resources.
    if (!raw.unlocked && Object.keys(def.unlockCost).length > 0) {
      out.push({
        id: `${id}.unlock`,
        label: `Unlock ${def.label}`,
        section: 'altarUnlock',
        level: 0,
        max: 1,
        priced: true,
        cost: () => ({ ...def.unlockCost }),
        apply: (draft) => {
          draft.altars[id].unlocked = true;
        },
      });
    }

    // Running an idle altar costs nothing and is usually the single largest
    // move available for runes, so it has to be rankable — it is the throughput
    // dial that trades essence for runes, which is the whole reason two lists
    // exist. Unpriced because it has no price, not because it is free of cost:
    // the essence it burns shows up in the essence delta.
    if (raw.unlocked && !raw.active) {
      out.push({
        id: `${id}.active`,
        label: `Run ${def.label}`,
        section: 'altarToggle',
        level: 0,
        max: 1,
        priced: false,
        cost: () => ({}),
        apply: (draft) => {
          draft.altars[id].active = true;
        },
      });
    }

    for (const up of def.upgrades) {
      const level = clamp(raw[up.key], up.max);
      if (level >= up.max) continue;
      out.push({
        id: `${id}.${up.key}`,
        label: `${def.label} · ${up.label}`,
        section: 'altar',
        level,
        max: up.max,
        priced: true,
        cost: (steps) => ({ [up.resource]: curveCost(up.curve, level, level + steps) }),
        apply: (draft, steps) => {
          draft.altars[id][up.key] = level + steps;
        },
      });
    }
  }

  for (const id of SPELL_IDS) {
    const def = SPELLS[id];
    const rank = clamp(input.spells[id].rank, def.maxRank);
    if (rank >= def.maxRank) continue;
    out.push({
      id: `${id}.potency`,
      label: `${def.label} Potency`,
      section: 'spell',
      level: rank,
      max: def.maxRank,
      priced: true,
      cost: (steps) => ({
        [def.potencyResource]: curveCost(def.potencyCurve, rank, rank + steps),
      }),
      apply: (draft, steps) => {
        draft.spells[id].rank = rank + steps;
      },
    });
  }

  // Every released Exchange upgrade now has a documented cost. Most affect
  // systems outside this calculator, so they score zero here; the two that feed
  // Arcanist maths can be compared by efficiency like any other purchase.
  for (const def of EXCHANGE_UPGRADES) {
    const level = clamp(input.exchange[def.id], def.max);
    if (level >= def.max) continue;
    out.push({
      id: def.id,
      label: def.label,
      section: 'exchange',
      level,
      max: def.max,
      priced: true,
      cost: (steps) =>
        def.cost.kind === 'tiered'
          ? tieredCost(def.cost.tiers, level, level + steps)
          : { [def.cost.resource]: curveCost(def.cost.curve, level, level + steps) },
      apply: (draft, steps) => {
        draft.exchange[def.id] = level + steps;
      },
    });
  }

  return out;
}

/**
 * Price one lever at one step size.
 *
 * `priced` narrows here rather than on the lever: a step that crosses an
 * essence-mine tier boundary costs two different runes, and a price in two
 * currencies cannot join a single-resource queue.
 */
export function candidateAt(lever: Lever, steps: number): Candidate {
  const capped = Math.max(1, Math.min(steps, lever.max - lever.level));
  const stepCost = lever.cost(capped);
  return {
    id: lever.id,
    label: lever.label,
    section: lever.section,
    level: lever.level,
    max: lever.max,
    steps: capped,
    to: lever.level + capped,
    key: capped === 1 ? lever.id : `${lever.id}+${capped}`,
    stepCost,
    priced: lever.priced,
    resource: lever.priced ? soleResource(stepCost) : undefined,
    apply: (draft) => lever.apply(draft, capped),
  };
}

/**
 * Every lever at one level, which is the shape the rest of the app assumes when
 * it just wants the list of available moves.
 */
export function enumerateCandidates(input: ArcanistInput): Candidate[] {
  return enumerateLevers(input).map((lever) => candidateAt(lever, 1));
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export interface Objectives {
  /** Sum of net essence per hour across the three tiers. */
  essencePerHour: number;
  /** Sum of runes per hour across altars that are unlocked and running. */
  runesPerHour: number;
  perEssence: Record<EssenceType, number>;
  perAltar: Record<AltarId, number>;
}

/**
 * Collapse a result into the two numbers being optimised.
 *
 * Both objectives are the *sustained* figures, not the nominal ones. Mining is
 * exclusive and altars stall on an empty pool, so an upgrade that raises an
 * altar's throughput past what the pool can feed changes nothing a player would
 * ever see — and ranking it as an improvement would send them to buy it.
 *
 * Rune output is gated on `unlocked && active` to match how `compute` gates the
 * matching essence drain — an idle altar costs nothing and produces nothing, and
 * counting its notional output would make unlocking look free.
 */
export function objectives(result: ArcanistResult): Objectives {
  const perEssence = {} as Record<EssenceType, number>;
  let essencePerHour = 0;
  for (const type of ESSENCE_TYPES) {
    const net = result.essence[type].sustainedNet;
    perEssence[type] = net;
    essencePerHour += net;
  }

  const perAltar = {} as Record<AltarId, number>;
  let runesPerHour = 0;
  for (const id of ALTAR_IDS) {
    const altar = result.altars[id];
    const rate = altar.unlocked && altar.active ? altar.sustainedRunesPerHour : 0;
    perAltar[id] = rate;
    runesPerHour += rate;
  }

  return { essencePerHour, runesPerHour, perEssence, perAltar };
}

// ---------------------------------------------------------------------------
// Marginal value
// ---------------------------------------------------------------------------

export interface Marginal {
  candidate: Candidate;
  /** Objective change from buying exactly one level. */
  delta: Objectives;
  /** Objective gain per unit of the step's cost. Zero when unpriced. */
  perCostEssence: number;
  perCostRunes: number;
  /**
   * Hours to afford this step from nothing, at the current sustained rate.
   *
   * Only defined for rune costs. Orb income is not modelled anywhere in this
   * app — the Arcanist sheet has no notion of it — and an invented figure would
   * be worse than a blank, so orb-priced rows simply carry no time.
   *
   * A one-purchase horizon on purpose. Rates move every time you buy something,
   * so this stays true for exactly as long as the decision it informs.
   */
  hoursToAfford?: number;
}

/**
 * Sustained runes per hour, by rune type.
 *
 * Sustained rather than nominal, so a starved altar reports what it can really
 * deliver: saving for a rune the altars cannot feed does not go faster because
 * the altar is well tuned.
 */
export function runeIncome(result: ArcanistResult): Partial<Record<Resource, number>> {
  const rates: Partial<Record<Resource, number>> = {};
  for (const id of ALTAR_IDS) {
    const altar = result.altars[id];
    const rate = altar.unlocked && altar.active ? altar.sustainedRunesPerHour : 0;
    rates[altar.rune] = (rates[altar.rune] ?? 0) + rate;
  }
  return rates;
}

const zeroObjectives = (): Objectives => ({
  essencePerHour: 0,
  runesPerHour: 0,
  perEssence: { soft: 0, dense: 0, jagged: 0 },
  perAltar: { ash: 0, brine: 0, chasm: 0 },
});

function subtract(after: Objectives, before: Objectives): Objectives {
  const delta = zeroObjectives();
  delta.essencePerHour = after.essencePerHour - before.essencePerHour;
  delta.runesPerHour = after.runesPerHour - before.runesPerHour;
  for (const type of ESSENCE_TYPES) {
    delta.perEssence[type] = after.perEssence[type] - before.perEssence[type];
  }
  for (const id of ALTAR_IDS) {
    delta.perAltar[id] = after.perAltar[id] - before.perAltar[id];
  }
  return delta;
}

/** Total magnitude of a cost bundle, for the per-cost ratio. */
function bundleSize(bundle: ResourceBundle): number {
  let sum = 0;
  for (const amount of Object.values(bundle)) sum += amount ?? 0;
  return sum;
}

/** The input with a step bought, leaving the caller's copy untouched. */
function applied(input: ArcanistInput, candidate: Candidate): ArcanistInput {
  const draft = structuredClone(input);
  candidate.apply(draft);
  return draft;
}

/**
 * What `candidate` is worth, by recomputing with it bought.
 *
 * `baseline` is passed in rather than recomputed so a full ranking pays for the
 * unmodified result once instead of once per candidate.
 */
export function marginalValue(
  input: ArcanistInput,
  candidate: Candidate,
  baseline: Objectives,
  income?: Partial<Record<Resource, number>>,
  /** The outcome with the step bought, when the caller already has it. */
  after?: Objectives,
): Marginal {
  const delta = subtract(after ?? objectives(compute(applied(input, candidate))), baseline);

  const size = bundleSize(candidate.stepCost);
  const priced = candidate.priced && size > 0;

  // Only where the whole cost is one resource we earn: a multi-resource price
  // would need the slowest of several waits, and orbs have no rate at all.
  const resource = candidate.resource;
  const rate = resource !== undefined ? (income?.[resource] ?? 0) : 0;
  const owed = resource !== undefined ? (candidate.stepCost[resource] ?? 0) : 0;

  // Unpriced rows get a literal zero rather than a scaled delta: multiplying a
  // negative delta by a zero ratio yields -0, which renders as "-0.0".
  return {
    candidate,
    delta,
    perCostEssence: priced ? delta.essencePerHour / size : 0,
    perCostRunes: priced ? delta.runesPerHour / size : 0,
    hoursToAfford: priced && rate > 0 ? owed / rate : undefined,
  };
}

// ---------------------------------------------------------------------------
// Step sizes
// ---------------------------------------------------------------------------

/**
 * How many step sizes to price per lever.
 *
 * One would only ever recommend the cheapest move that works, which is usually
 * right but not always: gain per boundary can grow faster than the cost curve,
 * so the second or third crossing occasionally wins on efficiency. Three is
 * where that stops paying for itself — the search is the only thing in this
 * module that costs more than a single recompute per row.
 */
export const STEPS_PER_LEVER = 3;

/** Whether two outcomes differ by more than float noise. */
function moved(after: Objectives, before: Objectives): boolean {
  const apart = (a: number, b: number) =>
    Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return (
    apart(after.essencePerHour, before.essencePerHour) ||
    apart(after.runesPerHour, before.runesPerHour)
  );
}

/**
 * The smallest step above `floor` that changes the outcome, or undefined if
 * nothing left on this lever does.
 *
 * Doubling probe then bisection, rather than walking level by level: a 25-level
 * row would otherwise cost 25 recomputes to discover it does nothing. This
 * assumes the outcome, once moved, stays moved — true because every lever here
 * is monotone in each objective (see the module header). A lever that violated
 * that would still get a real answer, just not necessarily the first one.
 */
function nextBreakpoint(
  floor: number,
  from: Objectives,
  remaining: number,
  at: (steps: number) => Objectives,
): number | undefined {
  // `lo` is the largest step known to leave the outcome alone, `hi` the
  // smallest known to change it.
  let lo = floor;
  let hi = remaining;
  for (let span = 1; ; span *= 2) {
    const probe = Math.min(floor + span, remaining);
    if (moved(at(probe), from)) {
      hi = probe;
      break;
    }
    if (probe >= remaining) return undefined;
    lo = probe;
  }

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (moved(at(mid), from)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The step sizes worth pricing on one lever.
 *
 * Only the sizes at which something changes. On a continuous row that is 1, 2,
 * 3 and the cheapest wins on efficiency, so the ranking looks exactly as it did
 * before. On a quantised row — damage, where `hitsToMine` is a whole number —
 * it is the levels that actually remove a hit, which is the whole point.
 */
function breakpoints(
  lever: Lever,
  baseline: Objectives,
  at: (steps: number) => Objectives,
): number[] {
  const remaining = lever.max - lever.level;
  const out: number[] = [];

  let floor = 0;
  let from = baseline;
  while (out.length < STEPS_PER_LEVER && floor < remaining) {
    const next = nextBreakpoint(floor, from, remaining, at);
    if (next === undefined) break;
    out.push(next);
    from = at(next);
    floor = next;
  }

  // A lever that moves neither objective at any level still belongs in the
  // ranking — dropping it would quietly hide a row the UI lists — so it is
  // scored at one level and honestly reports zero.
  return out.length > 0 ? out : [1];
}

/** Score every available candidate against the current build. */
export function rankAll(input: ArcanistInput, result?: ArcanistResult): Marginal[] {
  const base = result ?? compute(input);
  const baseline = objectives(base);
  const income = runeIncome(base);

  const out: Marginal[] = [];
  for (const lever of enumerateLevers(input)) {
    // The probe and the bisection revisit step sizes, and the winning size is
    // scored again below, so the recompute is memoised per lever.
    const seen = new Map<number, Objectives>();
    const at = (steps: number) => {
      let outcome = seen.get(steps);
      if (outcome === undefined) {
        outcome = objectives(compute(applied(input, candidateAt(lever, steps))));
        seen.set(steps, outcome);
      }
      return outcome;
    };

    for (const steps of breakpoints(lever, baseline, at)) {
      out.push(marginalValue(input, candidateAt(lever, steps), baseline, income, at(steps)));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

export type Goal = 'essence' | 'runes';

export interface ResourceQueue {
  resource: Resource;
  entries: Marginal[];
}

export interface Rankings {
  /**
   * Every scored candidate at every step size priced, unsorted, for callers
   * that want their own view. The queues below hold one entry per lever.
   */
  all: Marginal[];
  /** Priced candidates grouped by the resource they cost, best first. */
  byResource: ResourceQueue[];
  /**
   * Unpriced levers (Exchange rows, and any multi-resource cost) ranked by raw
   * effect. They carry no efficiency number because they have no known price.
   */
  unpriced: Marginal[];
}

const gain = (m: Marginal, goal: Goal) =>
  goal === 'essence' ? m.delta.essencePerHour : m.delta.runesPerHour;

const efficiency = (m: Marginal, goal: Goal) =>
  goal === 'essence' ? m.perCostEssence : m.perCostRunes;

/**
 * Which of two step sizes on the same lever to recommend for `goal`.
 *
 * Efficiency decides it wherever there is a price, which is what keeps the
 * cheapest step winning on rows that respond to a single level. Where there is
 * no price there is no efficiency, so the tiebreak is the smallest step that
 * gets the goal moving — otherwise an unpriced row would always recommend its
 * largest step, purely because more levels do more.
 */
function better(a: Marginal, b: Marginal, goal: Goal): boolean {
  const gainA = gain(a, goal);
  const gainB = gain(b, goal);
  if (gainA > 0 !== gainB > 0) return gainA > 0;

  if (a.candidate.priced && b.candidate.priced) {
    const effA = efficiency(a, goal);
    const effB = efficiency(b, goal);
    if (effA !== effB) return effA > effB;
  }
  return a.candidate.steps < b.candidate.steps;
}

/** One entry per lever: the step size that serves `goal` best. */
function bestPerLever(all: Marginal[], goal: Goal): Marginal[] {
  const best = new Map<string, Marginal>();
  for (const m of all) {
    const held = best.get(m.candidate.id);
    if (held === undefined || better(m, held, goal)) best.set(m.candidate.id, m);
  }
  return [...best.values()];
}

/**
 * Rank upgrades for one goal, split into a queue per resource.
 *
 * Resources are not interchangeable — white orbs cannot buy an altar craft
 * level — so a single merged list would be comparing prices in different
 * currencies. One queue per resource is the question the player actually has:
 * "I have a pile of this, what does it buy me".
 *
 * Multi-resource costs (the altar unlocks) cannot join a single-resource queue
 * without inventing an exchange rate, so they rank by raw gain alongside the
 * unpriced rows.
 *
 * A lever appears once, at its best step size for this goal. The two goals can
 * disagree about that size as freely as they disagree about the order.
 */
export function rankings(input: ArcanistInput, goal: Goal, result?: ArcanistResult): Rankings {
  return groupRankings(rankAll(input, result), goal);
}

/**
 * The goal-specific half of `rankings`, over a ranking that is already scored.
 *
 * Split out because scoring is the expensive part and does not depend on the
 * goal: the UI shows two lists and pays for the recomputes once.
 */
export function groupRankings(all: Marginal[], goal: Goal): Rankings {
  const queues = new Map<Resource, Marginal[]>();
  const unpriced: Marginal[] = [];

  for (const m of bestPerLever(all, goal)) {
    const resource = m.candidate.resource;
    if (!m.candidate.priced || resource === undefined) {
      unpriced.push(m);
      continue;
    }
    const list = queues.get(resource);
    if (list) list.push(m);
    else queues.set(resource, [m]);
  }

  const byResource: ResourceQueue[] = [];
  for (const [resource, entries] of queues) {
    entries.sort((a, b) => efficiency(b, goal) - efficiency(a, goal) || gain(b, goal) - gain(a, goal));
    byResource.push({ resource, entries });
  }

  // Order the queues themselves by their best entry, so the resource worth
  // spending first is the one at the top of the panel. Queues are only created
  // with a first entry, so the fallback is unreachable.
  const best = (queue: ResourceQueue) => {
    const top = queue.entries[0];
    return top ? efficiency(top, goal) : 0;
  };
  byResource.sort((a, b) => best(b) - best(a));

  unpriced.sort((a, b) => gain(b, goal) - gain(a, goal));

  return { all, byResource, unpriced };
}
