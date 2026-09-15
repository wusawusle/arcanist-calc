/**
 * Golden test: computing from the workbook's own input values must reproduce
 * the workbook's own cached results.
 *
 * This is what makes a ~120-quantity hand transcription trustworthy. Each
 * assertion names the Arcanist cell it mirrors, so a failure points straight at
 * the source. Comparison is relative (1e-9) because the engine uses closed-form
 * geometric sums where the sheet uses a running SUMPRODUCT.
 */

import { describe, expect, it } from 'vitest';

import { compute } from './engine';
import { ALTAR_IDS, CARD_SCALES, EXCHANGE_UPGRADES, cardValue } from './constants';
import { curveCost } from './costs';
import { formatCompact, formatShortScale } from './format';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';
import { CARD_TIERS, ESSENCE_TYPES } from './types';
import type { ArcanistInput } from './types';
import fixture from './__fixtures__/arcanist-sheet.json';

const cells = fixture.cells as Record<string, { v: number | string | boolean | null; f?: string }>;

/** The cached value of an Arcanist cell, as a number. */
function sheet(ref: string): number {
  const cell = cells[ref];
  if (!cell) throw new Error(`Fixture has no cell ${ref}`);
  const value = typeof cell.v === 'string' ? Number(cell.v) : cell.v;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Cell ${ref} is not numeric: ${JSON.stringify(cell.v)}`);
  }
  return value;
}

function expectMatchesSheet(actual: number, ref: string, label: string): void {
  const expected = sheet(ref);
  const tolerance = Math.max(Math.abs(expected) * 1e-9, 1e-9);
  expect(actual, `${label} (${ref})`).toBeCloseTo(expected, -Math.log10(tolerance));
}

const result = compute(EXAMPLE_INPUT);

describe('stats panel (M2:N17)', () => {
  const cases = [
    { label: 'Damage', ref: 'N3', actual: result.stats.damage },
    { label: 'Attack Speed', ref: 'N4', actual: result.stats.attackInterval },
    { label: 'Crit Chance', ref: 'N5', actual: result.stats.critChance },
    { label: 'Crit Damage', ref: 'N6', actual: result.stats.critDamage },
    { label: 'Super Crit Chance', ref: 'N7', actual: result.stats.superCritChance },
    { label: 'Ultra Crit Chance', ref: 'N9', actual: result.stats.ultraCritChance },
    { label: 'Ultra Crit Damage', ref: 'N10', actual: result.stats.ultraCritDamage },
    { label: 'Armor Pen', ref: 'N11', actual: result.stats.armorPen },
    { label: 'Stun Negate Chance', ref: 'N12', actual: result.stats.stunNegate },
    { label: 'Essence Shiny Chance', ref: 'N13', actual: result.stats.shinyChance },
    { label: 'Essence Shiny Bonus', ref: 'N14', actual: result.stats.shinyBonus },
    { label: 'Super Shiny Chance', ref: 'N15', actual: result.stats.superShinyChance },
    { label: 'Super Shiny Bonus', ref: 'N16', actual: result.stats.superShinyBonus },
    { label: 'Brittle Chance', ref: 'N17', actual: result.stats.brittleChance },
  ];

  it.each(cases)('$label matches $ref', ({ actual, ref, label }) => {
    expectMatchesSheet(actual, ref, label);
  });

  /**
   * The sheet hardcodes Super Crit Damage (N8) to 2 and never reads the
   * upgrade that feeds it (E15), unlike Crit Damage where N6 reads E9. Wired
   * up to mirror N6; confirmed against the game.
   */
  it('super crit damage is scaled by its upgrade, unlike the sheet', () => {
    // E15 = level 2 * 0.01, so 2 * 1.02.
    expect(result.stats.superCritDamage).toBeCloseTo(2.04, 9);
    expect(sheet('N8'), 'sheet leaves it flat').toBe(2);
    expect(sheet('E15'), 'sheet computes the upgrade but ignores it').toBeCloseTo(0.02, 9);
  });
});

describe('probability tables (Y3:AA33)', () => {
  it('shiny weights match Z4:Z6 / AA4:AA6', () => {
    const [normal, shiny, superShiny] = result.averages.shinyTable;
    expectMatchesSheet(normal!.chance, 'Z4', 'normal chance');
    expectMatchesSheet(shiny!.chance, 'Z5', 'shiny chance');
    expectMatchesSheet(shiny!.value, 'AA5', 'shiny bonus');
    expectMatchesSheet(superShiny!.chance, 'Z6', 'super shiny chance');
    expectMatchesSheet(superShiny!.value, 'AA6', 'super shiny bonus');
  });

  it('crit chances match Z16:Z19', () => {
    const [noCrit, crit, superCrit, ultraCrit] = result.averages.critTable;
    expectMatchesSheet(noCrit!.chance, 'Z16', 'no crit chance');
    expectMatchesSheet(crit!.chance, 'Z17', 'crit chance');
    expectMatchesSheet(crit!.value, 'AA17', 'crit multi');
    expectMatchesSheet(superCrit!.chance, 'Z18', 'super crit chance');
    expectMatchesSheet(ultraCrit!.chance, 'Z19', 'ultra crit chance');
  });

  /**
   * AA18 and AA19 are N6*N8 and N6*N8*N10, so scaling super crit damage moves
   * them — and moves the weighted average Z23 with them.
   */
  it('crit multipliers pick up the super crit damage fix', () => {
    const [, , superCrit, ultraCrit] = result.averages.critTable;
    expect(superCrit!.value).toBeCloseTo(2.18 * 2.04, 9);
    expect(ultraCrit!.value).toBeCloseTo(2.18 * 2.04 * 2, 9);
    expect(sheet('AA18')).toBeCloseTo(2.18 * 2, 9);
  });

  it('weighted averages match Z10 and Z33', () => {
    expectMatchesSheet(result.averages.shinyBonus, 'Z10', 'avg shiny bonus');
    expectMatchesSheet(result.averages.brittleMult, 'Z33', 'avg brittle multi');
  });

  it('avg crit multi shifts slightly above the sheet (Z23)', () => {
    // Only the super-crit branch changes, and it carries 0.13% of the weight.
    expect(result.averages.critMult).toBeGreaterThan(sheet('Z23'));
    expect(result.averages.critMult).toBeCloseTo(sheet('Z23'), 3);
  });
});

describe('per-essence mining (AB3:AJ22, V9:X13)', () => {
  const columns = {
    soft: { armor: 'AC11', min: 'AC4', max: 'AC5', stun: 'AC15', weaken: 'AC22', regen: 'AC18' },
    dense: { armor: 'AF11', min: 'AF4', max: 'AF5', stun: 'AF15', weaken: 'AF22', regen: 'AF18' },
    jagged: { armor: 'AI11', min: 'AI4', max: 'AI5', stun: 'AI15', weaken: 'AI22', regen: 'AI18' },
  } as const;

  for (const [type, refs] of Object.entries(columns) as [
    keyof typeof columns,
    (typeof columns)[keyof typeof columns],
  ][]) {
    it(`${type}: block stats after mitigation`, () => {
      const outcome = result.essence[type];
      expectMatchesSheet(outcome.armor, refs.armor, `${type} armor`);
      expectMatchesSheet(outcome.minLoot, refs.min, `${type} min loot`);
      expectMatchesSheet(outcome.maxLoot, refs.max, `${type} max loot`);
      expectMatchesSheet(outcome.avgStun, refs.stun, `${type} avg stun`);
      expectMatchesSheet(outcome.avgWeaken, refs.weaken, `${type} avg weaken`);
      expectMatchesSheet(outcome.avgRegen, refs.regen, `${type} avg regen`);
    });
  }

  it('soft: mining cycle and yield (AD3:AD5, W11, X11, Y11)', () => {
    const soft = result.essence.soft;
    expectMatchesSheet(soft.hitsToMine, 'AD3', 'soft hits to mine');
    expectMatchesSheet(soft.timeToMine, 'AD4', 'soft time to mine');
    expectMatchesSheet(soft.cycleTime, 'AD5', 'soft cycle time');
    expectMatchesSheet(soft.blocksPerHour, 'W11', 'soft blocks/hr');
    expectMatchesSheet(soft.trueLootAvg, 'AC9', 'soft true loot avg');
    expectMatchesSheet(soft.essencePerHour, 'X11', 'soft essence/hr');
    expectMatchesSheet(soft.brittleBlocksPerHour, 'Y11', 'soft brittle blocks/hr');
  });

  it('dense: mining cycle and yield (AG3:AG5, W12, X12, Y12)', () => {
    const dense = result.essence.dense;
    expectMatchesSheet(dense.hitsToMine, 'AG3', 'dense hits to mine');
    expectMatchesSheet(dense.timeToMine, 'AG4', 'dense time to mine');
    expectMatchesSheet(dense.cycleTime, 'AG5', 'dense cycle time');
    expectMatchesSheet(dense.blocksPerHour, 'W12', 'dense blocks/hr');
    expectMatchesSheet(dense.trueLootAvg, 'AF9', 'dense true loot avg');
    expectMatchesSheet(dense.essencePerHour, 'X12', 'dense essence/hr');
    expectMatchesSheet(dense.brittleBlocksPerHour, 'Y12', 'dense brittle blocks/hr');
  });

  it('net essence per hour (P16 for Soft, X28/X29)', () => {
    expectMatchesSheet(result.drain.soft, 'X28', 'soft altar drain');
    expectMatchesSheet(result.drain.dense, 'X29', 'dense altar drain');
    expect(result.drain.jagged, 'no altar consumes Jagged').toBe(0);
    expectMatchesSheet(result.essence.soft.netEssencePerHour, 'P16', 'net soft essence/hr');
  });

  /**
   * The sheet's AJ3 subtracts the empty cell AI1 instead of AI18 (Jagged avg
   * regen), so Jagged reads 82 hits where the corrected math gives 84. Assert the
   * corrected value AND that it really does differ from the sheet, so this stays
   * an intentional deviation rather than a silent transcription slip.
   */
  it('jagged: corrected for the AJ3 regen-reference bug', () => {
    const jagged = result.essence.jagged;
    expect(jagged.hitsToMine).toBe(84);
    expect(sheet('AJ3'), 'sheet still has the buggy value').toBe(82);
    expectMatchesSheet(jagged.armor, 'AI11', 'jagged armor');
    expectMatchesSheet(jagged.avgStun, 'AI15', 'jagged avg stun');
    expectMatchesSheet(jagged.avgWeaken, 'AI22', 'jagged avg weaken');
    // Downstream values inherit the correction.
    expect(jagged.timeToMine).toBe(168);
    expect(jagged.cycleTime).toBe(183);
  });
});

/**
 * The observable spread behind the average.
 *
 * The hourly figures are built from `trueLootAvg`, which is correct as an
 * expectation but is not a number any single block pays. These are the bounds a
 * player actually sees, and the sheet has no equivalent — it never modelled the
 * range, only the mean.
 */
describe('loot range', () => {
  it('tops out at a max roll that also procs super shiny', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.pets.rhinoCard = 'polychrome'; // a super shiny source
    const soft = compute(input).essence.soft;
    const stats = compute(input).stats;

    expect(stats.shinyChance).toBeGreaterThan(0);
    expect(stats.superShinyChance).toBeGreaterThan(0);
    expect(soft.luckiestLoot).toBeCloseTo(
      soft.maxLoot + stats.shinyBonus + stats.superShinyBonus,
      9,
    );
  });

  it('leaves out a bonus the build cannot roll', () => {
    // The example has no super shiny source, so the top is a plain shiny.
    const soft = result.essence.soft;
    expect(result.stats.superShinyChance).toBe(0);
    expect(soft.luckiestLoot).toBeCloseTo(soft.maxLoot + result.stats.shinyBonus, 9);

    // And with no shiny chance at all, the roll is the whole story.
    const dull = structuredClone(FRESH_INPUT);
    const dullSoft = compute(dull).essence.soft;
    expect(compute(dull).stats.shinyChance).toBe(0);
    expect(dullSoft.luckiestLoot).toBe(dullSoft.maxLoot);
  });

  it('brackets the average it is shown beside', () => {
    for (const type of ESSENCE_TYPES) {
      const outcome = result.essence[type];
      expect(outcome.trueLootAvg, type).toBeGreaterThanOrEqual(outcome.minLoot);
      expect(outcome.trueLootAvg, type).toBeLessThanOrEqual(outcome.luckiestLoot);
    }
  });
});

describe('altars (I29:L41, U27:X30)', () => {
  it('rune craft multiplier matches Statmath!C372', () => {
    expect(result.runeCraftMulti).toBeCloseTo(1.28412, 9);
  });

  const cases = [
    { id: 'ash', cycle: 'I29', perCycle: 'J29', perHour: 'K29', cost: 'L29' },
    { id: 'brine', cycle: 'I34', perCycle: 'J34', perHour: 'K34', cost: 'L34' },
    { id: 'chasm', cycle: 'I39', perCycle: 'J39', perHour: 'K39', cost: 'L39' },
  ] as const;

  it.each(cases)('$id altar output', ({ id, cycle, perCycle, perHour, cost }) => {
    const altar = result.altars[id];
    expectMatchesSheet(altar.cycleTime, cycle, `${id} cycle time`);
    expectMatchesSheet(altar.runesPerCycle, perCycle, `${id} runes/cycle`);
    expectMatchesSheet(altar.runesPerHour, perHour, `${id} runes/hr`);
    expectMatchesSheet(altar.essenceCostPerHour, cost, `${id} essence cost/hr`);
  });
});

describe('spells (E45:L66)', () => {
  const cases = [
    { id: 'runicSurge', secondary: 'E46', duration: 'L45', potency: 'G45' },
    { id: 'rainbowRift', primary: 'E49', secondary: 'E50', duration: 'L49', potency: 'G49' },
    { id: 'manaflow', primary: 'E53', secondary: 'E54', duration: 'L53', potency: 'G53' },
    { id: 'radiancy', primary: 'E57', secondary: 'E58', duration: 'L57', potency: 'G57' },
    { id: 'prismism', primary: 'E61', secondary: 'E62', duration: 'L61', potency: 'G61' },
  ] as const;

  it.each(cases)('$id effects, duration and potency cost', (spell) => {
    const outcome = result.spells[spell.id];
    if ('primary' in spell) {
      expectMatchesSheet(outcome.primary, spell.primary, `${spell.id} primary`);
    }
    expectMatchesSheet(outcome.secondary, spell.secondary, `${spell.id} secondary`);
    expectMatchesSheet(outcome.duration, spell.duration, `${spell.id} duration`);
    expectMatchesSheet(outcome.potencyCostRemaining, spell.potency, `${spell.id} potency cost`);
  });

  /**
   * Runic Surge's primary (E45) nests the pet bonus inside the rank term, unlike
   * the other five spells. Normalised to the majority form, so it differs.
   */
  it('runicSurge primary is normalised away from the E45 nesting', () => {
    expect(result.spells.runicSurge.primary).toBeCloseTo(0.4455, 9);
    expect(sheet('E45')).toBeCloseTo(0.4455, 9);
    // With no pet potency bonus the two forms coincide; prove they diverge when it is non-zero.
    // Unlocking the Rhino Quest Skin is what grants Arcanist Spell Power.
    const withPet = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        pets: { ...EXAMPLE_INPUT.external.pets, rhinoQuestSkin: true, rhinoQuestLevel: 5 },
      },
    });
    const power = withPet.derived.petSpellPower;
    expect(power).toBeCloseTo(6 * 0.015, 9);
    const sheetForm = 0.15 * 1.2 * (1 + 13 * 0.05) * (1 + 10 * 0.05 * (1 + power));
    expect(withPet.spells.runicSurge.primary).not.toBeCloseTo(sheetForm, 6);
  });

  /**
   * Veinboyant is locked (A64 = 0) yet the sheet's E66 still grants 0.15 Rune
   * Craft Multi because the secondary effects lack an unlock guard.
   */
  it('locked spells grant nothing, unlike the sheet', () => {
    expect(result.spells.veinboyant.unlocked).toBe(false);
    expect(result.spells.veinboyant.primary).toBe(0);
    expect(result.spells.veinboyant.secondary).toBe(0);
    expect(sheet('E66'), 'sheet leaks the locked effect').toBeCloseTo(0.15, 9);
  });
});

describe('total resource costs (A87:C110)', () => {
  /**
   * Orbs are spent only by essence and altar upgrades, so these still match the
   * sheet exactly — except white, which carries the damagePct cost correction
   * below. Rune totals deliberately diverge from the old workbook because the
   * restored Exchange rows use the current wiki costs rather than its stale
   * cached values.
   */
  const cases = [
    ['greenOrb', 'C90'],
    ['purpleOrb', 'C91'],
    ['orangeOrb', 'C92'],
    ['redOrb', 'C93'],
  ] as const;

  it.each(cases)('%s remaining matches %s', (resource, ref) => {
    expectMatchesSheet(result.totals.remaining[resource], ref, `${resource} remaining`);
  });

  /** The whole of the white-orb gap is the one corrected row, and nothing else. */
  it('whiteOrb remaining is C89 plus the damagePct correction', () => {
    expect(result.totals.remaining.whiteOrb).toBeCloseTo(sheet('C89') + sheet('G18') * 0.5, 6);
  });

  it('rune totals include the restored Exchange rows', () => {
    const nonExchange = [
      ...result.rows.essence,
      ...ALTAR_IDS.flatMap((id) => result.rows.altars[id]),
      ...result.rows.altarUnlocks,
      ...result.rows.spells,
    ];
    for (const resource of ['ashRune', 'brineRune', 'chasmRune'] as const) {
      const base = nonExchange.reduce((n, row) => n + (row.remaining[resource] ?? 0), 0);
      const exchange = result.rows.exchange.reduce(
        (n, row) => n + (row.remaining[resource] ?? 0),
        0,
      );
      expect(exchange, `${resource} Exchange contribution`).toBeGreaterThan(0);
      expect(result.totals.remaining[resource]).toBeCloseTo(base + exchange, 6);
    }
  });

  it('sums only priced rows', () => {
    const sumOf = (rows: { remaining: Record<string, number | undefined> }[], key: string) =>
      rows.reduce((n, row) => n + (row.remaining[key] ?? 0), 0);

    const expectedWhite =
      sumOf(result.rows.essence, 'whiteOrb') +
      ALTAR_IDS.reduce((n, id) => n + sumOf(result.rows.altars[id], 'whiteOrb'), 0);

    expect(result.totals.remaining.whiteOrb).toBeCloseTo(expectedWhite, 6);
  });
});

describe('per-row costs match the sheet cell for cell', () => {
  /** Cost Remaining cells (column G) for every row with a curve-based cost. */
  const essenceRows: [string, string][] = [
    ['flatDamage1', 'G5'],
    ['softMaxLoot', 'G6'],
    ['shinyChance1', 'G7'],
    ['critChance1', 'G8'],
    ['flatDamage2', 'G10'],
    ['denseMaxLoot', 'G12'],
    ['armorPen', 'G13'],
    ['superCrit1', 'G14'],
    ['flatDamage3', 'G16'],
    ['shinyLoot', 'G19'],
    ['shinyChance2', 'G20'],
    ['critChance2', 'G22'],
    ['jaggedLoot', 'G24'],
  ];

  it.each(essenceRows)('essence %s matches %s', (id, ref) => {
    const row = result.rows.essence.find((r) => r.id === id);
    const amount = Object.values(row!.remaining)[0] ?? 0;
    expectMatchesSheet(amount, ref, `${id} cost remaining`);
  });

  /**
   * Flat Damage +2% starts at 3 white orbs, not the sheet's 2 — see
   * CORRECTIONS.md. The whole curve scales with its base, so every figure on
   * this row is exactly 1.5x what the workbook cached. Assert the corrected
   * value AND that the sheet still disagrees, so this stays an intentional
   * deviation rather than a silent transcription slip.
   */
  it('essence damagePct: corrected cost base (G18)', () => {
    const row = result.rows.essence.find((r) => r.id === 'damagePct')!;
    const amount = Object.values(row.remaining)[0] ?? 0;
    expect(amount).toBeCloseTo(sheet('G18') * 1.5, 6);
    expect(sheet('G18'), 'sheet still has the understated base').toBeLessThan(amount);
  });

  const altarRows: [string, string, string][] = [
    ['ash', 'capacity', 'G29'],
    ['ash', 'travel', 'G30'],
    ['ash', 'craft', 'G31'],
    ['brine', 'capacity', 'G34'],
    ['brine', 'travel', 'G35'],
    ['brine', 'craft', 'G36'],
    ['chasm', 'capacity', 'G39'],
    ['chasm', 'travel', 'G40'],
  ];

  it.each(altarRows)('altar %s %s matches %s', (altar, key, ref) => {
    const row = result.rows.altars[altar as 'ash'].find((r) => r.id === `${altar}.${key}`);
    const amount = Object.values(row!.remaining)[0] ?? 0;
    expectMatchesSheet(amount, ref, `${altar} ${key} cost remaining`);
  });

  it('total costs (column H) match where the sheet stores them', () => {
    const flatDamage1 = result.rows.essence.find((r) => r.id === 'flatDamage1');
    expect(flatDamage1!.total.whiteOrb).toBeCloseTo(471.98108322034466, 6);
    const armorPen = result.rows.essence.find((r) => r.id === 'armorPen');
    expect(armorPen!.total.purpleOrb).toBe(75);
  });
});

/**
 * Exchange costs were undocumented when this project was first written, so the
 * old app intentionally omitted them. The supplied 12 Sep 2026 wiki snapshot
 * now documents all thirteen released rows; these assertions pin that data so
 * a future workbook refresh cannot silently restore the older stale curves.
 */
describe('exchange upgrades use the current wiki costs', () => {
  const fresh = compute(FRESH_INPUT);

  const ids = [
    'exchangeWizards',
    'exchangeTimer',
    'arcaneCardDamage',
    'rainbowFloorMulti',
    'lootbugBankedCap',
    'goldenPortalChance',
    'starSupergiantMulti',
    'wizardLootMulti',
    'geminiStarCap',
    'veinboyantUnlock',
    'prismaticFloorChance',
    'shinyFishMulti',
    'runeCraftMulti',
  ] as const;

  it('models all thirteen released Exchange upgrades plus the WIP Spell Power row', () => {
    expect(EXCHANGE_UPGRADES.filter((def) => !!def.cost).map((def) => def.id)).toEqual(ids);
    expect(fresh.rows.exchange).toHaveLength(14);

    const released = fresh.rows.exchange.filter((row) => row.id !== 'arcanistSpellPower');
    expect(released).toHaveLength(13);
    expect(released.every((row) => row.priced)).toBe(true);

    const spellPower = fresh.rows.exchange.find((row) => row.id === 'arcanistSpellPower')!;
    expect(spellPower.priced).toBe(false);
    expect(spellPower.next).toEqual({});
    expect(spellPower.remaining).toEqual({});
  });

  it('pins every documented full-row cost', () => {
    const expected = {
      exchangeTimer: ['blueCow', 232_500],
      arcaneCardDamage: ['scorpioStar', 10e12],
      rainbowFloorMulti: ['ashRune', 157_541.36479067343],
      lootbugBankedCap: ['prestigePoints', 4.2619497283e26],
      goldenPortalChance: ['brineRune', 411_040.5842005646],
      starSupergiantMulti: ['lynxStar', 5.872008345722352e16],
      wizardLootMulti: ['softEssence', 24_939.677238464355],
      geminiStarCap: ['superstars', 21_309_748_641.5],
      veinboyantUnlock: ['stoneVein', 50e21],
      prismaticFloorChance: ['chasmRune', 83_643.1550234846],
      shinyFishMulti: ['aquariusStar', 6.301654591626937e16],
      runeCraftMulti: ['denseEssence', 54_843.418860808],
    } as const;

    const wizard = fresh.rows.exchange.find((row) => row.id === 'exchangeWizards')!;
    expect(wizard.total).toEqual({ ashRune: 2500, brineRune: 2500, chasmRune: 2500 });
    expect(wizard.next).toEqual({ ashRune: 2500 });

    for (const [id, [resource, total]] of Object.entries(expected)) {
      const row = fresh.rows.exchange.find((candidate) => candidate.id === id)!;
      const actual = Number(row.total[resource as keyof typeof row.total]);
      const relativeError = Math.abs(actual - total) / Math.max(1, Math.abs(total));
      expect(relativeError, `${id} total relative error`).toBeLessThan(1e-12);
    }
  });

  it('uses only the ten Gemini levels that have a documented cost table', () => {
    expect(EXCHANGE_UPGRADES.find((def) => def.id === 'geminiStarCap')!.max).toBe(10);
  });

  it('puts Exchange-only currencies back in Total Resources', () => {
    for (const resource of [
      'blueCow',
      'scorpioStar',
      'lynxStar',
      'aquariusStar',
      'superstars',
      'prestigePoints',
      'stoneVein',
      'softEssence',
      'denseEssence',
    ] as const) {
      expect(fresh.totals.total[resource], resource).toBeGreaterThan(0);
      expect(fresh.totals.spendable, `${resource} listed`).toContain(resource);
    }
  });

  it('still excludes Red Orb because no released row spends it', () => {
    expect(fresh.totals.total.redOrb).toBe(0);
    expect(fresh.totals.spendable).not.toContain('redOrb');
  });
});

/**
 * Exclusive mining and altar stalling.
 *
 * The workbook has no notion of either — it models all three essences earning
 * at once and lets an altar drain a pool past empty — so none of this can be
 * checked against the sheet. What it can be checked against is the old model:
 * every one of these must reduce to the previous behaviour whenever the pool
 * being mined outpaces the altars drawing on it.
 */
describe('essence supply', () => {
  /** All three altars running, which the example's mining rate cannot feed. */
  const starvedInput = (() => {
    const input = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) {
      input.altars[id].unlocked = true;
      input.altars[id].active = true;
    }
    return input;
  })();

  it('leaves a fed pool completely untouched', () => {
    // EXAMPLE_INPUT mines Soft and runs one altar on it; income covers drain.
    const fed = compute(EXAMPLE_INPUT);
    expect(fed.essence.soft.essencePerHour).toBeGreaterThan(fed.essence.soft.altarDrain);

    expect(fed.altars.brine.supplyFactor).toBe(1);
    expect(fed.altars.brine.sustainedRunesPerHour).toBe(fed.altars.brine.runesPerHour);
    expect(fed.essence.soft.sustainedNet).toBeCloseTo(fed.essence.soft.netEssencePerHour, 9);
  });

  it('throttles altars to the share of demand the pool can meet', () => {
    const starved = compute(starvedInput);
    const soft = starved.essence.soft;

    expect(soft.essencePerHour).toBeLessThan(soft.altarDrain);
    const expected = soft.essencePerHour / soft.altarDrain;

    // Ash and Brine share the Soft pool, so they throttle by the same factor.
    for (const id of ['ash', 'brine'] as const) {
      expect(starved.altars[id].supplyFactor).toBeCloseTo(expected, 9);
      expect(starved.altars[id].sustainedRunesPerHour).toBeCloseTo(
        starved.altars[id].runesPerHour * expected,
        9,
      );
    }
  });

  it('starves an altar whose pool is not being mined at all', () => {
    // Chasm drains Dense; the example mines Soft, so Dense has no income.
    const starved = compute(starvedInput);
    expect(starvedInput.mining).not.toBe('dense');
    expect(starved.altars.chasm.supplyFactor).toBe(0);
    expect(starved.altars.chasm.sustainedRunesPerHour).toBe(0);
    // The nominal rate is untouched — it is what the altar *would* do if fed.
    expect(starved.altars.chasm.runesPerHour).toBeGreaterThan(0);
  });

  it('banks nothing from an essence it is not mining', () => {
    const result = compute(EXAMPLE_INPUT);
    for (const type of ESSENCE_TYPES) {
      if (type === EXAMPLE_INPUT.mining) continue;
      expect(result.essence[type].sustainedNet, type).toBe(0);
    }
  });

  it('reports a starved pool as banking exactly zero, not a negative', () => {
    // The sheet's net goes negative here, which no player can experience: the
    // altars stall instead of overdrawing the pool.
    const starved = compute(starvedInput);
    expect(starved.essence.soft.netEssencePerHour).toBeLessThan(0);
    expect(starved.essence.soft.sustainedNet).toBe(0);
  });

  it('leaves an altar on a pool nothing drains at full rate', () => {
    const idle = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) idle.altars[id].active = false;
    const result = compute(idle);
    for (const id of ALTAR_IDS) expect(result.altars[id].supplyFactor).toBe(1);
  });

  /**
   * The claim the altar-shutdown advice rests on: an altar converts essence to
   * runes at a rate set by craft, its card and the global multiplier — and
   * *not* by capacity or travel speed. If a balance patch broke this, choosing
   * which altar to run would become a search rather than a rule.
   */
  it('converts at a ratio independent of capacity and travel', () => {
    const ratio = (input: ArcanistInput, id: (typeof ALTAR_IDS)[number]) => {
      const altar = compute(input).altars[id];
      return altar.runesPerHour / altar.essenceCostPerHour;
    };

    for (const id of ALTAR_IDS) {
      const base = ratio(EXAMPLE_INPUT, id);

      const tuned = structuredClone(EXAMPLE_INPUT);
      tuned.altars[id].capacity = 25;
      tuned.altars[id].travel = 10;
      expect(ratio(tuned, id), id).toBeCloseTo(base, 9);

      const crafted = structuredClone(EXAMPLE_INPUT);
      crafted.altars[id].craft = 10;
      expect(ratio(crafted, id), id).toBeGreaterThan(base);
    }
  });
});

describe('card tiers', () => {
  /**
   * Pinned against the in-game values. Arcanist cards go up to Polychrome
   * only; the sheet's fourth branch (Infernal, column G) cannot fire for these
   * cards, so it is not modelled.
   */
  it.each([
    { scale: 'essenceMaxLoot', normal: 1, gilded: 2, polychrome: 4 },
    { scale: 'altarCraft', normal: 0.15, gilded: 0.3, polychrome: 0.5 },
    { scale: 'spell', normal: 0.1, gilded: 0.2, polychrome: 0.35 },
    { scale: 'superShiny', normal: 0.01, gilded: 0.02, polychrome: 0.04 },
  ] as const)('$scale tiers', ({ scale, normal, gilded, polychrome }) => {
    const table = CARD_SCALES[scale];
    expect(cardValue(table, 'none')).toBe(0);
    expect(cardValue(table, 'normal')).toBeCloseTo(normal, 10);
    expect(cardValue(table, 'gilded')).toBeCloseTo(gilded, 10);
    expect(cardValue(table, 'polychrome')).toBeCloseTo(polychrome, 10);
  });

  it('offers exactly the four states an Arcanist card can be in', () => {
    expect(CARD_TIERS).toEqual(['none', 'normal', 'gilded', 'polychrome']);
  });

  /**
   * The example preset's tiers were read back from the workbook's computed K
   * values, so these pin the tier names to those numbers: a renamed or
   * reordered tier cannot silently change what the preset means. (Only the
   * Arcanist sheet is in the fixture, so the expected values are the
   * workbook's cached Cards K-column results, quoted here.)
   */
  it('reproduces the workbook values the example preset was read from', () => {
    const { cards } = EXAMPLE_INPUT.external;
    expect(cardValue(CARD_SCALES.essenceMaxLoot, cards.essence.soft)).toBe(4); // K422
    expect(cardValue(CARD_SCALES.essenceMaxLoot, cards.essence.dense)).toBe(1); // K423
    expect(cardValue(CARD_SCALES.essenceMaxLoot, cards.essence.jagged)).toBe(1); // K424
    expect(cardValue(CARD_SCALES.altarCraft, cards.rune.ash)).toBeCloseTo(0.5, 10); // K429
    expect(cardValue(CARD_SCALES.altarCraft, cards.rune.brine)).toBeCloseTo(0.3, 10); // K430
    expect(cardValue(CARD_SCALES.altarCraft, cards.rune.chasm)).toBe(0); // K431
    expect(cardValue(CARD_SCALES.spell, cards.spell.runicSurge)).toBeCloseTo(0.2, 10); // K438
    expect(cardValue(CARD_SCALES.spell, cards.spell.rainbowRift)).toBeCloseTo(0.2, 10); // K439
    expect(cardValue(CARD_SCALES.spell, cards.spell.manaflow)).toBeCloseTo(0.1, 10); // K440
    expect(cardValue(CARD_SCALES.spell, cards.spell.radiancy)).toBe(0); // K441
    expect(cardValue(CARD_SCALES.orbTrade, cards.orb.white)).toBeCloseTo(0.3, 10); // K446
    expect(cardValue(CARD_SCALES.orbTrade, cards.orb.purple)).toBeCloseTo(0.15, 10); // K448
  });
});

/**
 * The arcane card count used to be typed in by hand. It is now derived from
 * the card grid, so this pins the derivation against the workbook's Cards!K456
 * with the workbook's own card collection.
 */
describe('derived external bonuses', () => {
  it('reproduces Cards!K456 from the card tiers', () => {
    expect(result.derived.arcaneCardCount).toBe(20);
  });

  it('counts cumulative tiers, since owning Polychrome means owning all three', () => {
    const oneOfEach = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        cards: {
          essence: { soft: 'normal', dense: 'gilded', jagged: 'polychrome' },
          rune: { ash: 'none', brine: 'none', chasm: 'none' },
          spell: {
            runicSurge: 'none',
            rainbowRift: 'none',
            manaflow: 'none',
            radiancy: 'none',
            prismism: 'none',
            veinboyant: 'none',
          },
          orb: {
            white: 'none',
            green: 'none',
            purple: 'none',
            orange: 'none',
            red: 'none',
            yellow: 'none',
          },
        },
      },
    });
    expect(oneOfEach.derived.arcaneCardCount).toBe(1 + 2 + 3);
  });

  it('converts pet levels and unlocks into the workbook values', () => {
    // Pets!E38 = A37 * 0.01, with the workbook's Rhino at level 5.
    expect(result.derived.petBrittle).toBeCloseTo(0.05, 10);
    // Contracts!D45 = A45 * 0.005, with the workbook at level 16.
    expect(result.derived.contractRuneCraft).toBeCloseTo(0.08, 10);
    // Nothing else is unlocked in the workbook's build.
    expect(result.derived.petQuestShiny).toBe(0);
    expect(result.derived.petSpellPower).toBe(0);
    expect(result.derived.statueSuperShiny).toBe(0);
    expect(result.derived.spellDurationMulti).toBe(1);
    expect(result.derived.storeRuneCraft).toBe(0);
  });

  it('grants the first quest-skin step at level 0', () => {
    const withQuest = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        pets: { ...EXAMPLE_INPUT.external.pets, rhinoQuestSkin: true, rhinoQuestLevel: 0 },
      },
    });
    expect(withQuest.derived.petQuestShiny).toBeCloseTo(0.005, 10);
    expect(withQuest.derived.petSpellPower).toBeCloseTo(0.015, 10);

    const maxed = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        pets: { ...EXAMPLE_INPUT.external.pets, rhinoQuestSkin: true, rhinoQuestLevel: 11 },
      },
    });
    expect(maxed.derived.petQuestShiny).toBeCloseTo(0.06, 10);
    expect(maxed.derived.petSpellPower).toBeCloseTo(0.18, 10);
  });

  it('grants nothing from the quest skin until it is unlocked', () => {
    const locked = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        pets: { ...EXAMPLE_INPUT.external.pets, rhinoQuestSkin: false, rhinoQuestLevel: 11 },
      },
    });
    expect(locked.derived.petQuestShiny).toBe(0);
    expect(locked.derived.petSpellPower).toBe(0);
  });

  it('drives all four Arcanist Bundle effects from one unlock', () => {
    const bundled = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        unlocks: { ...EXAMPLE_INPUT.external.unlocks, arcanistBundle: true },
      },
    });
    expect(bundled.derived.storeRuneCraft).toBeCloseTo(0.1, 10);
    expect(bundled.derived.spellDurationMulti).toBeCloseTo(1.1, 10);
    expect(bundled.stats.shinyChance - result.stats.shinyChance).toBeCloseTo(0.01, 10);
    expect(bundled.runeCraftMulti).toBeGreaterThan(result.runeCraftMulti);
  });

  it('scales the statue bonus by the number of W4 gilded statues', () => {
    const statues = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        unlocks: {
          ...EXAMPLE_INPUT.external.unlocks,
          statueOfNatureGilded: true,
          w4GildedStatues: 7,
        },
      },
    });
    expect(statues.derived.statueSuperShiny).toBeCloseTo(0.07, 10);
    expect(statues.stats.superShinyChance).toBeCloseTo(0.07, 10);
  });

  it('ignores the statue count while the statue is not gilded', () => {
    const ungilded = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        unlocks: {
          ...EXAMPLE_INPUT.external.unlocks,
          statueOfNatureGilded: false,
          w4GildedStatues: 7,
        },
      },
    });
    expect(ungilded.derived.statueSuperShiny).toBe(0);
  });
});

describe('cost curves', () => {
  it('closed form matches a running sum', () => {
    const runningGeometric = (base: number, ratio: number, from: number, to: number) => {
      let sum = 0;
      for (let i = from + 1; i <= to; i += 1) sum += base * ratio ** (i - 1);
      return sum;
    };
    expect(curveCost({ kind: 'geometric', base: 1, ratio: 1.2 }, 17, 25)).toBeCloseTo(
      runningGeometric(1, 1.2, 17, 25),
      9,
    );
    expect(curveCost({ kind: 'arithmetic', first: 500, step: 500 }, 15, 30)).toBe(172500);
    expect(curveCost({ kind: 'arithmetic', first: 3, step: 0 }, 8, 25)).toBe(51);
  });

  it('is zero at or past max', () => {
    expect(curveCost({ kind: 'geometric', base: 5, ratio: 1.3 }, 10, 10)).toBe(0);
    expect(curveCost({ kind: 'geometric', base: 5, ratio: 1.3 }, 12, 10)).toBe(0);
  });
});

describe('formatting', () => {
  it('matches the sheet short-scale style', () => {
    expect(formatShortScale(1726.8254497711916)).toBe('1.73 Thousand');
    expect(formatShortScale(276451.64011217502)).toBe('276.45 Thousand');
    expect(formatShortScale(3.8629497283000019e26)).toBe('386.29 Septillion');
    expect(formatShortScale(521.31628686712111)).toBe('521.32');
    expect(formatShortScale(0)).toBe('0');
  });

  it('produces compact suffixes', () => {
    expect(formatCompact(1726.82)).toBe('1.73K');
    expect(formatCompact(232500)).toBe('232.5K');
  });
});

describe('fresh preset', () => {
  const fresh = compute(FRESH_INPUT);

  it('is a coherent starting state', () => {
    expect(fresh.stats.damage).toBe(10);
    expect(fresh.drain.soft).toBe(0);
  });

  it('still mines soft essence with base damage', () => {
    expect(fresh.essence.soft.unmineable).toBe(false);
    expect(fresh.essence.soft.blocksPerHour).toBeGreaterThan(0);
  });

  it('reports jagged as unmineable when damage cannot beat armour and regen', () => {
    // Base damage 10, jagged armour 10 -> zero effective damage.
    expect(fresh.essence.jagged.unmineable).toBe(true);
    expect(fresh.essence.jagged.blocksPerHour).toBe(0);
    expect(fresh.essence.jagged.essencePerHour).toBe(0);
  });

  it('charges the full cost of everything', () => {
    expect(fresh.totals.remaining.whiteOrb).toBeCloseTo(
      compute(FRESH_INPUT).totals.total.whiteOrb,
      6,
    );
  });
});
