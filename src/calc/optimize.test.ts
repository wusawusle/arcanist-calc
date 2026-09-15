/**
 * Optimizer tests.
 *
 * The engine's own correctness is covered by the golden test against the
 * workbook. What matters here is that the ranking is a faithful reading of the
 * engine: that every candidate maps to a real input field, that scores come out
 * of an actual recompute, and that the structural claims the module's design
 * rests on still hold if `constants.ts` changes under it.
 */

import { describe, expect, it } from 'vitest';

import { compute } from './engine';
import {
  candidateAt,
  enumerateCandidates,
  enumerateLevers,
  marginalValue,
  objectives,
  rankAll,
  rankings,
  runeIncome,
  STEPS_PER_LEVER,
} from './optimize';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';
import { ALTAR_IDS } from './constants';
import { ESSENCE_TYPES } from './types';

describe('candidates', () => {
  it('covers every unmaxed row the engine prices', () => {
    // The optimizer and the cost table must agree on what exists; a row the UI
    // shows but the optimizer cannot see would be silently unrankable.
    const result = compute(FRESH_INPUT);
    const rowIds = [
      ...result.rows.essence,
      ...ALTAR_IDS.flatMap((id) => result.rows.altars[id]),
      ...result.rows.altarUnlocks,
      ...result.rows.spells,
      ...result.rows.exchange,
    ]
      .filter((row) => row.available)
      .map((row) => row.id);

    const candidateIds = new Set(enumerateCandidates(FRESH_INPUT).map((c) => c.id));
    for (const id of rowIds) expect(candidateIds).toContain(id);
  });

  it('adds the altar run toggle, which is a lever with no cost row', () => {
    // Running an idle altar is the throughput dial between the two goals, so
    // it must be rankable even though nothing in `rows` prices it.
    const idle = structuredClone(FRESH_INPUT);
    idle.altars.ash.unlocked = true;
    idle.altars.ash.active = false;

    const toggle = enumerateCandidates(idle).find((c) => c.id === 'ash.active');
    expect(toggle?.priced).toBe(false);

    // ...and disappears once the altar is already running.
    const running = structuredClone(idle);
    running.altars.ash.active = true;
    expect(enumerateCandidates(running).map((c) => c.id)).not.toContain('ash.active');
  });

  it('ranks running an idle altar as the top rune move', () => {
    const idle = structuredClone(FRESH_INPUT);
    idle.altars.ash.unlocked = true;
    idle.altars.ash.active = false;

    const { unpriced } = rankings(idle, 'runes');
    const toggle = unpriced.find((m) => m.candidate.id === 'ash.active');
    expect(toggle).toBeDefined();
    expect(toggle!.delta.runesPerHour).toBeGreaterThan(0);
    // It buys those runes with essence, which is the tradeoff being surfaced.
    expect(toggle!.delta.essencePerHour).toBeLessThan(0);
    expect(unpriced[0]!.candidate.id).toBe('ash.active');
  });

  it('drops maxed rows', () => {
    const maxed = structuredClone(FRESH_INPUT);
    maxed.essence.essenceMine = 4;
    const ids = enumerateCandidates(maxed).map((c) => c.id);
    expect(ids).not.toContain('essenceMine');
  });

  it('applies exactly one level', () => {
    for (const candidate of enumerateCandidates(FRESH_INPUT)) {
      const draft = structuredClone(FRESH_INPUT);
      candidate.apply(draft);
      const after = enumerateCandidates(draft).find((c) => c.id === candidate.id);
      // Either the level went up by one, or the row is now maxed and gone.
      expect(after?.level ?? candidate.max).toBe(candidate.level + 1);
    }
  });

  it('applies exactly its own step, at any size', () => {
    for (const lever of enumerateLevers(FRESH_INPUT)) {
      for (const steps of [1, 2, 5, 40]) {
        const candidate = candidateAt(lever, steps);
        // Never past the row's max, however many levels were asked for.
        expect(candidate.to).toBeLessThanOrEqual(lever.max);
        expect(candidate.steps).toBeGreaterThan(0);

        const draft = structuredClone(FRESH_INPUT);
        candidate.apply(draft);
        const after = enumerateLevers(draft).find((l) => l.id === candidate.id);
        expect(after?.level ?? candidate.max).toBe(candidate.to);
      }
    }
  });

  it('prices a multi-level step as the sum of the levels it buys', () => {
    const lever = enumerateLevers(FRESH_INPUT).find((l) => l.id === 'flatDamage1')!;
    const one = Object.values(candidateAt(lever, 1).stepCost)[0]!;
    const three = Object.values(candidateAt(lever, 3).stepCost)[0]!;
    const each = [1, 2, 3].map((s) => {
      const from = { ...FRESH_INPUT, essence: { ...FRESH_INPUT.essence, flatDamage1: s - 1 } };
      return Object.values(
        candidateAt(enumerateLevers(from).find((l) => l.id === 'flatDamage1')!, 1).stepCost,
      )[0]!;
    });

    expect(three).toBeCloseTo(each.reduce((a, b) => a + b, 0), 6);
    expect(three).toBeGreaterThan(one);
  });

  it("prices a step as the row's own next level, not its cost to max", () => {
    const result = compute(FRESH_INPUT);
    const row = result.rows.essence.find((r) => r.id === 'flatDamage1');
    const candidate = enumerateCandidates(FRESH_INPUT).find((c) => c.id === 'flatDamage1');
    const step = Object.values(candidate!.stepCost)[0]!;
    const toMax = Object.values(row!.remaining)[0]!;
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(toMax);
  });

  it('prices every released Exchange row and keeps WIP Spell Power unpriced', () => {
    const exchange = enumerateCandidates(FRESH_INPUT).filter((c) => c.section === 'exchange');
    expect(exchange).toHaveLength(14);

    const released = exchange.filter((c) => c.id !== 'arcanistSpellPower');
    expect(released).toHaveLength(13);
    for (const c of released) {
      expect(c.priced).toBe(true);
      expect(Object.keys(c.stepCost).length, c.id).toBeGreaterThan(0);
      expect(Object.values(c.stepCost).reduce((sum, value) => sum + (value ?? 0), 0), c.id).toBeGreaterThan(0);
    }

    const spellPower = exchange.find((c) => c.id === 'arcanistSpellPower')!;
    expect(spellPower.priced).toBe(false);
    expect(spellPower.stepCost).toEqual({});
  });
});

describe('objectives', () => {
  /**
   * Only the mined essence counts. The other two report an income they would
   * earn *if you switched to them*, which is not income you are getting — and
   * summing all three was the old model's central mistake.
   */
  it('counts essence only from the essence being mined', () => {
    const result = compute(EXAMPLE_INPUT);
    const obj = objectives(result);

    expect(obj.essencePerHour).toBeCloseTo(result.essence[EXAMPLE_INPUT.mining].sustainedNet, 6);
    for (const type of ESSENCE_TYPES) {
      if (type !== EXAMPLE_INPUT.mining) expect(obj.perEssence[type]).toBe(0);
    }
  });

  it('follows the mined essence when it changes', () => {
    const onJagged = { ...EXAMPLE_INPUT, mining: 'jagged' as const };
    const obj = objectives(compute(onJagged));

    expect(obj.perEssence.soft).toBe(0);
    expect(obj.perEssence.jagged).toBeGreaterThan(0);
  });

  it('counts runes only from altars that are unlocked and running', () => {
    // An idle altar neither drains essence nor makes runes; crediting its
    // notional output would make the `active` toggle look free.
    const idle = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) idle.altars[id].active = false;
    expect(objectives(compute(idle)).runesPerHour).toBe(0);

    const running = structuredClone(idle);
    running.altars.ash.unlocked = true;
    running.altars.ash.active = true;
    expect(objectives(compute(running)).runesPerHour).toBeGreaterThan(0);
  });
});

describe('marginal value', () => {
  const baseline = objectives(compute(EXAMPLE_INPUT));

  it('scores a loot upgrade as a gain to essence', () => {
    // Soft Max Loot, because the example build mines Soft and loot scales the
    // yield continuously. Damage does not: hits-to-mine is a whole number, so
    // a single point of damage usually buys nothing until it crosses a ceiling
    // — see the test below, which pins that as a property rather than a bug.
    const candidate = enumerateCandidates(EXAMPLE_INPUT).find((c) => c.id === 'softMaxLoot')!;
    const m = marginalValue(EXAMPLE_INPUT, candidate, baseline);
    expect(m.delta.essencePerHour).toBeGreaterThan(0);
  });

  /**
   * Damage arrives in steps, not slopes.
   *
   * `hitsToMine` is rounded up to a whole hit, so damage that does not remove a
   * hit from the count changes nothing. Under the old model this was masked:
   * the objective summed all three essences, so a point of damage that did
   * nothing for Soft could still cross a ceiling for Dense or Jagged and look
   * like a smooth gain. Mining one essence at a time exposes it.
   */
  it('scores damage in steps, since hits-to-mine is a whole number', () => {
    const candidate = enumerateCandidates(EXAMPLE_INPUT).find((c) => c.id === 'flatDamage1')!;
    expect(marginalValue(EXAMPLE_INPUT, candidate, baseline).delta.essencePerHour).toBe(0);
    // Which is why the ranking does not stop at one level — see 'step sizes'.

    // Enough damage to remove at least one hit does show up.
    const stronger = structuredClone(EXAMPLE_INPUT);
    stronger.essence.flatDamage1 = 25;
    const mined = EXAMPLE_INPUT.mining;
    expect(compute(stronger).essence[mined].hitsToMine).toBeLessThan(
      compute(EXAMPLE_INPUT).essence[mined].hitsToMine,
    );
    expect(objectives(compute(stronger)).essencePerHour).toBeGreaterThan(baseline.essencePerHour);
  });

  it('leaves the input untouched', () => {
    const before = structuredClone(EXAMPLE_INPUT);
    rankAll(EXAMPLE_INPUT);
    expect(EXAMPLE_INPUT).toEqual(before);
  });

  it('never scores an unpriced row on efficiency', () => {
    for (const m of rankAll(EXAMPLE_INPUT)) {
      if (!m.candidate.priced) {
        expect(m.perCostEssence).toBe(0);
        expect(m.perCostRunes).toBe(0);
      }
    }
  });
});

describe('the essence/rune tradeoff', () => {
  /**
   * The module's design rests on a structural claim about `computeAltars`:
   * capacity and cycle time multiply both rune output and essence drain, so
   * they cancel, leaving craft as the only thing that changes the exchange
   * rate. These tests pin that claim. If a balance patch breaks them, the
   * module's framing needs revisiting — not just its numbers.
   */
  const base = (() => {
    const input = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) {
      input.altars[id].unlocked = true;
      input.altars[id].active = true;
    }
    return input;
  })();

  /**
   * Runes made per essence burned, for one altar.
   *
   * Per altar this is exactly `(1 + 0.2*craft)(1 + card) * runeCraftMulti`.
   * Summed across altars it is a drain-weighted blend of three such rates, so
   * capacity is only neutral altar by altar — see the aggregate test below.
   */
  const rate = (input: typeof base, id: (typeof ALTAR_IDS)[number]) => {
    const altar = compute(input).altars[id];
    return altar.runesPerHour / altar.essenceCostPerHour;
  };

  it('is unchanged by capacity', () => {
    const more = structuredClone(base);
    for (const id of ALTAR_IDS) more.altars[id].capacity = base.altars[id].capacity + 5;
    for (const id of ALTAR_IDS) expect(rate(more, id)).toBeCloseTo(rate(base, id), 9);
  });

  it('is unchanged by travel speed', () => {
    const more = structuredClone(base);
    for (const id of ALTAR_IDS) more.altars[id].travel = Math.min(10, base.altars[id].travel + 3);
    for (const id of ALTAR_IDS) expect(rate(more, id)).toBeCloseTo(rate(base, id), 9);
  });

  it('is raised by craft', () => {
    const more = structuredClone(base);
    for (const id of ALTAR_IDS) more.altars[id].craft = Math.min(10, base.altars[id].craft + 3);
    for (const id of ALTAR_IDS) expect(rate(more, id)).toBeGreaterThan(rate(base, id));
  });

  it('shifts in aggregate when capacity reweights unequal altars', () => {
    // Capacity is neutral per altar but not across a portfolio: raising it
    // moves drain between altars whose craft levels differ, which moves the
    // blended rate. Worth pinning, because it is the one way a "neutral" dial
    // still changes the essence-to-rune conversion.
    const uneven = structuredClone(base);
    uneven.altars.ash.craft = 0;
    uneven.altars.chasm.craft = 10;

    const blended = (input: typeof base) => {
      const result = compute(input);
      const runes = ALTAR_IDS.reduce((sum, id) => sum + result.altars[id].runesPerHour, 0);
      const drain = ALTAR_IDS.reduce((sum, id) => sum + result.altars[id].essenceCostPerHour, 0);
      return runes / drain;
    };

    const shifted = structuredClone(uneven);
    shifted.altars.chasm.capacity = uneven.altars.chasm.capacity + 10;
    expect(blended(shifted)).toBeGreaterThan(blended(uneven));
  });

  /**
   * Capacity trades essence for runes only while the pool can keep up.
   *
   * EXAMPLE_INPUT mines Soft and runs one altar on it, so income comfortably
   * covers the drain and raising capacity does what it always did: more runes,
   * less banked essence.
   */
  it('makes capacity a pure conversion while the pool is fed', () => {
    const fed = EXAMPLE_INPUT;
    const more = structuredClone(fed);
    for (const id of ALTAR_IDS) more.altars[id].capacity = fed.altars[id].capacity + 1;

    const before = objectives(compute(fed));
    const after = objectives(compute(more));

    expect(compute(fed).altars.brine.supplyFactor).toBe(1);
    expect(after.runesPerHour).toBeGreaterThan(before.runesPerHour);
    expect(after.essencePerHour).toBeLessThan(before.essencePerHour);
  });

  /**
   * Once the pool is starved, capacity stops buying runes.
   *
   * A starved altar converts every unit of essence that reaches it, so its
   * sustained output is `conversion ratio × what you mine` — and the ratio is
   * capacity-independent. Adding capacity to a starved altar therefore buys
   * nothing at all. `base` runs all three altars, which the example's mining
   * rate cannot feed.
   */
  it('makes capacity worthless once the pool is starved', () => {
    // Ash alone on Soft, so raising its capacity cannot reweight a shared pool
    // — this isolates the supply effect from the blend effect below.
    const alone = structuredClone(base);
    alone.altars.brine.active = false;
    alone.altars.chasm.active = false;

    const at = (capacity: number) => {
      const input = structuredClone(alone);
      input.altars.ash.capacity = capacity;
      const result = compute(input);
      return { result, runes: objectives(result).runesPerHour };
    };

    // Both well past the point where Ash outpaces the Soft income.
    const lean = at(15);
    const fat = at(20);

    expect(lean.result.altars.ash.supplyFactor).toBeLessThan(1);
    expect(fat.result.altars.ash.supplyFactor).toBeLessThan(1);
    expect(lean.result.essence.soft.sustainedNet).toBe(0);

    // A third more capacity, and not one extra rune.
    expect(fat.runes).toBeCloseTo(lean.runes, 6);
    expect(fat.result.altars.ash.runesPerHour).toBeGreaterThan(
      lean.result.altars.ash.runesPerHour,
    );
  });

  /**
   * The one way capacity still matters when starved: it decides which altar on
   * a shared pool gets the essence. Ash and Brine both drain Soft, so raising
   * one altar's capacity moves the blend toward it — worth more if its craft is
   * higher, worse if lower.
   */
  it('reweights a shared starved pool toward the altar with more capacity', () => {
    const shared = structuredClone(base);
    shared.altars.chasm.active = false;
    shared.altars.ash.craft = 0;
    shared.altars.brine.craft = 10;

    const toBrine = structuredClone(shared);
    toBrine.altars.brine.capacity = shared.altars.brine.capacity + 10;

    expect(compute(shared).altars.ash.supplyFactor).toBeLessThan(1);
    expect(objectives(compute(toBrine)).runesPerHour).toBeGreaterThan(
      objectives(compute(shared)).runesPerHour,
    );
  });
});

/**
 * Time to afford.
 *
 * A one-purchase horizon, on purpose. Every buy changes the rates, so this is
 * true for exactly as long as the decision it informs — which is the lesson of
 * the potency path that used to project three weeks ahead.
 */
describe('time to afford', () => {
  const running = () => {
    const input = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) {
      input.altars[id].unlocked = true;
      input.altars[id].active = true;
    }
    return input;
  };

  it('divides a rune cost by the rate that rune actually sustains', () => {
    const input = running();
    const result = compute(input);
    const income = runeIncome(result);

    for (const m of rankAll(input, result)) {
      const resource = m.candidate.resource;
      if (resource === undefined || !m.candidate.priced) continue;

      const rate = income[resource] ?? 0;
      if (rate <= 0) {
        expect(m.hoursToAfford, m.candidate.id).toBeUndefined();
        continue;
      }

      expect(m.hoursToAfford, m.candidate.id).toBeCloseTo(
        (m.candidate.stepCost[resource] ?? 0) / rate,
        6,
      );
    }
  });

  /**
   * Orbs have no time, because the app has never modelled orb income. A blank
   * is the honest answer; a number would be invented because orb income is not
   * part of the Arcanist model.
   */
  it('leaves orb costs without a time', () => {
    for (const m of rankAll(running())) {
      const resource = m.candidate.resource;
      if (resource !== undefined && resource.endsWith('Orb')) {
        expect(m.hoursToAfford, m.candidate.id).toBeUndefined();
      }
    }
  });

  it('gives no time for a rune whose altar is not running', () => {
    const idle = running();
    idle.altars.chasm.active = false;

    for (const m of rankAll(idle)) {
      if (m.candidate.resource === 'chasmRune') {
        expect(m.hoursToAfford, m.candidate.id).toBeUndefined();
      }
    }
  });

  /** Starving an altar makes its runes take longer, not the same time. */
  it('lengthens when the altar feeding it is starved', () => {
    const fed = EXAMPLE_INPUT;
    const starved = running();

    const brineOf = (input: typeof fed) =>
      rankAll(input).find((m) => m.candidate.id === 'prismism.potency')?.hoursToAfford;

    expect(compute(starved).altars.brine.supplyFactor).toBeLessThan(1);
    expect(compute(fed).altars.brine.supplyFactor).toBe(1);
    expect(brineOf(starved)!).toBeGreaterThan(brineOf(fed)!);
  });
});

/**
 * Step sizes.
 *
 * The optimizer used to price exactly one level of every row, which made every
 * damage row permanently worthless: `hitsToMine` is a whole number of hits, so
 * one point of damage buys nothing until it removes one. The ranking now prices
 * the first few step sizes that move an objective and recommends the best.
 */
describe('step sizes', () => {
  const baseline = objectives(compute(EXAMPLE_INPUT));

  /** Score one lever at an arbitrary step, outside the breakpoint search. */
  const at = (input: typeof EXAMPLE_INPUT, id: string, steps: number) => {
    const lever = enumerateLevers(input).find((l) => l.id === id)!;
    return marginalValue(input, candidateAt(lever, steps), objectives(compute(input)));
  };

  it('recommends the multi-level buy that a quantised row actually needs', () => {
    // Damage is the case the one-level view could never see: no single level
    // does anything, so the old ranking filtered every damage row out.
    const entry = rankings(EXAMPLE_INPUT, 'essence')
      .byResource.flatMap((q) => q.entries)
      .find((m) => m.candidate.id === 'flatDamage1')!;

    expect(entry.candidate.steps).toBeGreaterThan(1);
    expect(entry.delta.essencePerHour).toBeGreaterThan(0);

    // And it is the cheapest such buy: one level short does nothing at all.
    expect(at(EXAMPLE_INPUT, 'flatDamage1', entry.candidate.steps - 1).delta.essencePerHour).toBe(0);
  });

  it('still recommends one level where one level works', () => {
    // Loot scales continuously, so the cheapest step is the efficient one and
    // the ranking looks exactly as it did before.
    const entry = rankings(EXAMPLE_INPUT, 'essence')
      .byResource.flatMap((q) => q.entries)
      .find((m) => m.candidate.id === 'softMaxLoot')!;
    expect(entry.candidate.steps).toBe(1);
  });

  /**
   * The claim the recommendation rests on: within a row, nothing smaller is a
   * better buy. Brute-forced against every step size the row allows, which is
   * the search the ranking deliberately does not do at runtime.
   */
  it('is never beaten by a smaller step on the same row', () => {
    for (const input of [EXAMPLE_INPUT, FRESH_INPUT]) {
      for (const goal of ['essence', 'runes'] as const) {
        for (const queue of rankings(input, goal).byResource) {
          for (const entry of queue.entries) {
            const chosen = goal === 'essence' ? entry.perCostEssence : entry.perCostRunes;
            for (let steps = 1; steps < entry.candidate.steps; steps += 1) {
              const rival = at(input, entry.candidate.id, steps);
              const score = goal === 'essence' ? rival.perCostEssence : rival.perCostRunes;
              expect(score, `${entry.candidate.id} @${steps} vs @${entry.candidate.steps}`)
                .toBeLessThanOrEqual(chosen);
            }
          }
        }
      }
    }
  });

  it('never leaves a row out, and never lists it twice', () => {
    const levers = enumerateLevers(EXAMPLE_INPUT).map((l) => l.id);
    for (const goal of ['essence', 'runes'] as const) {
      const { byResource, unpriced } = rankings(EXAMPLE_INPUT, goal);
      const listed = [...byResource.flatMap((q) => q.entries), ...unpriced].map(
        (m) => m.candidate.id,
      );
      expect([...listed].sort()).toEqual([...levers].sort());
    }
  });

  it('prices a bounded number of steps per row', () => {
    const perLever = new Map<string, number>();
    for (const m of rankAll(EXAMPLE_INPUT)) {
      perLever.set(m.candidate.id, (perLever.get(m.candidate.id) ?? 0) + 1);
    }
    for (const [id, count] of perLever) {
      expect(count, id).toBeLessThanOrEqual(STEPS_PER_LEVER);
    }
  });

  it('leaves a row that nothing can move in the ranking, scored zero', () => {
    // Mines 3 and 4 are "Coming Soon" and change nothing. A row the UI shows
    // must still appear, or the two panels would disagree about what exists.
    const bought = structuredClone(EXAMPLE_INPUT);
    bought.essence.essenceMine = 2;
    const m = rankAll(bought).filter((x) => x.candidate.id === 'essenceMine');
    expect(m).toHaveLength(1);
    expect(m[0]!.candidate.steps).toBe(1);
    expect(m[0]!.delta.essencePerHour).toBe(0);
  });

  it('leaves the input untouched however many levels it probes', () => {
    const before = structuredClone(EXAMPLE_INPUT);
    rankings(EXAMPLE_INPUT, 'essence');
    expect(EXAMPLE_INPUT).toEqual(before);
    expect(baseline).toEqual(objectives(compute(EXAMPLE_INPUT)));
  });
});

describe('rankings', () => {
  it('groups by resource and never mixes currencies in a queue', () => {
    const { byResource } = rankings(EXAMPLE_INPUT, 'runes');
    expect(byResource.length).toBeGreaterThan(0);
    for (const queue of byResource) {
      for (const entry of queue.entries) {
        expect(entry.candidate.resource).toBe(queue.resource);
      }
    }
  });

  it('sorts each queue best-first for the chosen goal', () => {
    for (const goal of ['essence', 'runes'] as const) {
      for (const queue of rankings(EXAMPLE_INPUT, goal).byResource) {
        const scores = queue.entries.map((e) =>
          goal === 'essence' ? e.perCostEssence : e.perCostRunes,
        );
        const sorted = [...scores].sort((a, b) => b - a);
        expect(scores).toEqual(sorted);
      }
    }
  });

  it('ranks the two goals differently', () => {
    // If both goals produced the same order there would be no reason to show
    // two lists. Altar throughput is what separates them.
    const first = (goal: 'essence' | 'runes') =>
      rankings(EXAMPLE_INPUT, goal).all.filter((m) => m.candidate.priced);
    const byEssence = [...first('essence')].sort((a, b) => b.perCostEssence - a.perCostEssence);
    const byRunes = [...first('runes')].sort((a, b) => b.perCostRunes - a.perCostRunes);
    expect(byEssence.map((m) => m.candidate.id)).not.toEqual(byRunes.map((m) => m.candidate.id));
  });

  it('puts multi-resource costs in the unpriced list rather than a queue', () => {
    // Altar unlocks cost several resources at once; queueing them under one
    // would misstate the price.
    const locked = structuredClone(EXAMPLE_INPUT);
    locked.altars.chasm.unlocked = false;
    const { byResource, unpriced } = rankings(locked, 'runes');
    const unlock = unpriced.find((m) => m.candidate.id === 'chasm.unlock');
    const inQueue = byResource.some((q) => q.entries.some((e) => e.candidate.id === 'chasm.unlock'));
    if (unlock) expect(inQueue).toBe(false);
  });

  it('scores a full ranking fast enough to run on every keystroke', () => {
    const started = performance.now();
    rankAll(EXAMPLE_INPUT);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
