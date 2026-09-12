/**
 * The Arcanist calculator.
 *
 * `compute` is a pure function of its inputs with no allocation-heavy work
 * beyond the result object, so a future goal-seek can call it in a loop.
 *
 * Order matters in one place: Prismism's secondary effect and the Rune Craft
 * Multiplier exchange upgrade both feed `runeCraftMulti`, which feeds altar
 * output. The sheet expresses this as a cross-sheet cycle
 * (Statmath!C372 -> Arcanist!E62); here it is simply resolved first.
 */

import {
  ALTARS,
  ALTAR_CRAFT_PER_LEVEL,
  ALTAR_IDS,
  ALTAR_TRAVEL_PER_LEVEL,
  BASE_STATS,
  BLOCKS,
  CARD_SCALES,
  CARD_TIER_COUNT,
  CONTRACT_RUNE_CRAFT,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  PET,
  RESOURCES,
  SPELLS,
  SPELL_IDS,
  SPELL_LEVEL_PER_RANK,
  UNLOCKS,
  cardValue,
} from './constants';
import { addBundle, curveCost, tieredCost } from './costs';
import { formatEffect } from './format';
import type {
  AltarId,
  AltarOutcome,
  ArcanistInput,
  ArcanistResult,
  Averages,
  BlockDef,
  CardTier,
  DerivedBonuses,
  EffectKey,
  EssenceOutcome,
  EssenceType,
  ExternalBonuses,
  Resource,
  ResourceBundle,
  SpellId,
  SpellOutcome,
  Stats,
  UpgradeCost,
  WeightedOutcome,
} from './types';
import { ESSENCE_TYPES } from './types';

type Effects = Record<EffectKey, number>;

const clampLevel = (level: number, max: number) =>
  Number.isFinite(level) ? Math.min(Math.max(Math.trunc(level), 0), max) : 0;

const emptyResourceRecord = (): Record<Resource, number> => {
  const out = {} as Record<Resource, number>;
  for (const r of RESOURCES) out[r] = 0;
  return out;
};

function deriveBonuses(ext: ExternalBonuses): DerivedBonuses {
  const { cards, pets, unlocks } = ext;

  // Cumulative tiers, matching how the workbook counts its four tier flags.
  const countTiers = (tiers: Record<string, CardTier>) =>
    Object.values(tiers).reduce((n, tier) => n + CARD_TIER_COUNT[tier], 0);

  const rhinoLevel = clampLevel(pets.rhinoLevel, PET.maxLevel);
  const questLevel = clampLevel(pets.rhinoQuestLevel, PET.maxQuestLevel);
  // Level 0 already grants the first step, hence the +1.
  const questSteps = pets.rhinoQuestSkin ? questLevel + 1 : 0;

  return {
    arcaneCardCount:
      countTiers(cards.essence) +
      countTiers(cards.rune) +
      countTiers(cards.spell) +
      countTiers(cards.orb),
    petBrittle: rhinoLevel * PET.brittlePerLevel,
    petQuestShiny: questSteps * PET.questShinyPerStep,
    petSpellPower: questSteps * PET.questSpellPowerPerStep,
    petMaxEssenceLoot: pets.rhinoSkin ? PET.skinMaxLoot : 0,
    statueSuperShiny: unlocks.statueOfNatureGilded
      ? Math.max(unlocks.w4GildedStatues, 0) * UNLOCKS.statueSuperShinyPerStatue
      : 0,
    spellDurationMulti: 1 + (unlocks.arcanistBundle ? UNLOCKS.bundleSpellDuration : 0),
    storeRuneCraft: unlocks.arcanistBundle ? UNLOCKS.bundleRuneCraft : 0,
    contractRuneCraft:
      clampLevel(ext.contractRuneCraftLevel, CONTRACT_RUNE_CRAFT.maxLevel) *
      CONTRACT_RUNE_CRAFT.perLevel,
  };
}

/** Sum every essence upgrade's per-level effects at their current levels. */
function collectEffects(input: ArcanistInput): Effects {
  const effects = {} as Effects;
  for (const def of ESSENCE_UPGRADES) {
    const level = clampLevel(input.essence[def.id], def.max);
    for (const effect of def.effects) {
      effects[effect.key] = (effects[effect.key] ?? 0) + level * effect.perLevel;
    }
  }
  // Ensure every key is present even when no upgrade touched it.
  for (const def of ESSENCE_UPGRADES) {
    for (const effect of def.effects) effects[effect.key] ??= 0;
  }
  return effects;
}

/**
 * A spell's effect multiplier. The sheet gates only the primary effect on the
 * unlock flag and nests Runic Surge's pet bonus differently from the other
 * five; both are normalised here (see CORRECTIONS.md).
 */
function spellEffect(
  base: number,
  unlocked: boolean,
  level: number,
  rank: number,
  cardBonus: number,
  petPotency: number,
): number {
  if (!unlocked) return 0;
  return (
    base *
    (1 + cardBonus) *
    (1 + level * SPELL_LEVEL_PER_RANK) *
    (1 + rank * SPELL_LEVEL_PER_RANK) *
    (1 + petPotency)
  );
}

function computeSpells(input: ArcanistInput, ext: ExternalBonuses, derived: DerivedBonuses) {
  const outcomes = {} as Record<SpellId, SpellOutcome>;

  for (const id of SPELL_IDS) {
    const def = SPELLS[id];
    const raw = input.spells[id];
    const unlocked = raw.unlocked;
    const level = clampLevel(raw.level, def.maxLevel);
    const rank = clampLevel(raw.rank, def.maxRank);
    const cardBonus = cardValue(CARD_SCALES.spell, ext.cards.spell[id]);
    const spellPower = derived.petSpellPower;

    outcomes[id] = {
      id,
      unlocked,
      primary: spellEffect(def.primary.base, unlocked, level, rank, cardBonus, spellPower),
      secondary: spellEffect(def.secondary.base, unlocked, level, rank, cardBonus, spellPower),
      duration: def.durationBase * (1 + rank * SPELL_LEVEL_PER_RANK) * derived.spellDurationMulti,
      potencyCostNext: rank >= def.maxRank ? 0 : curveCost(def.potencyCurve, rank, rank + 1),
      potencyCostRemaining: curveCost(def.potencyCurve, rank, def.maxRank),
      potencyCostTotal: curveCost(def.potencyCurve, 0, def.maxRank),
      potencyResource: def.potencyResource,
    };
  }

  return outcomes;
}

function computeStats(
  effects: Effects,
  spells: Record<SpellId, SpellOutcome>,
  exchangeLevels: ArcanistInput['exchange'],
  ext: ExternalBonuses,
  derived: DerivedBonuses,
): Stats {
  const { pets, unlocks } = ext;
  const arcaneCardDamage = exchangeLevels.arcaneCardDamage >= 1 ? derived.arcaneCardCount : 0;

  const flatDamage =
    BASE_STATS.baseDamage +
    effects.flatDamage1 +
    effects.flatDamage2 +
    effects.flatDamage3 +
    arcaneCardDamage;

  return {
    damage: flatDamage * (1 + effects.damagePct),
    attackInterval: BASE_STATS.attackInterval,
    critChance: effects.critChance1 + effects.critChance2,
    critDamage: BASE_STATS.critDamage * (1 + effects.critDamage),
    superCritChance: effects.superCritChance1 + effects.superCritChance2,
    superCritDamage: BASE_STATS.superCritDamage * (1 + effects.superCritDamage),
    ultraCritChance: BASE_STATS.ultraCritChance,
    ultraCritDamage: BASE_STATS.ultraCritDamage,
    armorPen: effects.armorPen,
    stunNegate: effects.stunNegate,
    shinyChance:
      effects.shinyChance1 +
      effects.shinyChance2 +
      spells.runicSurge.secondary +
      (unlocks.worldQuest25 ? UNLOCKS.worldQuest25Shiny : 0) +
      (unlocks.straightOuttaYanille ? UNLOCKS.yanilleShiny : 0) +
      (unlocks.arcanistBundle ? UNLOCKS.bundleShiny : 0) +
      derived.petQuestShiny,
    shinyBonus: BASE_STATS.shinyBonusBase + effects.shinyLoot,
    superShinyChance:
      cardValue(CARD_SCALES.superShiny, pets.rhinoCard) +
      derived.statueSuperShiny +
      (unlocks.worldQuest29 ? UNLOCKS.worldQuest29SuperShiny : 0),
    superShinyBonus: BASE_STATS.superShinyBonus,
    brittleChance:
      effects.brittleChance1 +
      effects.brittleChance2 +
      (unlocks.straightOuttaYanille ? UNLOCKS.yanilleBrittle : 0) +
      derived.petBrittle,
  };
}

/** The sheet's Y3:AA33 probability tables, kept as tables so the UI can show them. */
function computeAverages(stats: Stats): Averages {
  const { shinyChance, superShinyChance, shinyBonus, superShinyBonus } = stats;
  const shinyTable: WeightedOutcome[] = [
    { label: 'normal', chance: 1 - shinyChance, value: 0 },
    { label: 'shiny', chance: shinyChance * (1 - superShinyChance), value: shinyBonus },
    {
      label: 'super shiny',
      chance: shinyChance * superShinyChance,
      value: shinyBonus + superShinyBonus,
    },
  ];

  const { critChance: cc, superCritChance: scc, ultraCritChance: ucc } = stats;
  const { critDamage: cd, superCritDamage: scd, ultraCritDamage: ucd } = stats;
  const critTable: WeightedOutcome[] = [
    { label: 'no crit', chance: 1 - cc, value: 1 },
    { label: 'crit', chance: cc * (1 - scc), value: cd },
    { label: 'super crit', chance: cc * scc * (1 - ucc), value: cd * scd },
    { label: 'ultra crit', chance: cc * scc * ucc, value: cd * scd * ucd },
  ];

  const brittleTable: WeightedOutcome[] = [
    { label: 'normal', chance: 1 - stats.brittleChance, value: 1 },
    { label: 'brittle', chance: stats.brittleChance, value: BASE_STATS.brittleMult },
  ];

  const weighted = (rows: WeightedOutcome[]) =>
    rows.reduce((sum, row) => sum + row.chance * row.value, 0);

  return {
    shinyTable,
    shinyBonus: weighted(shinyTable),
    critTable,
    critMult: weighted(critTable),
    brittleTable,
    brittleMult: weighted(brittleTable),
  };
}

function lootRange(
  type: EssenceType,
  block: BlockDef,
  effects: Effects,
  ext: ExternalBonuses,
  derived: DerivedBonuses,
): { min: number; max: number } {
  const shared =
    derived.petMaxEssenceLoot + cardValue(CARD_SCALES.essenceMaxLoot, ext.cards.essence[type]);

  switch (type) {
    case 'soft':
      return {
        min: block.baseMinLoot,
        max: block.baseMaxLoot + effects.softMaxLoot + shared,
      };
    case 'dense':
      return {
        min: block.baseMinLoot,
        max: block.baseMaxLoot + effects.denseMaxLoot + shared,
      };
    case 'jagged':
      return {
        min: block.baseMinLoot + effects.jaggedMinLoot,
        max: block.baseMaxLoot + effects.jaggedMaxLoot + shared,
      };
  }
}

function computeEssence(
  type: EssenceType,
  stats: Stats,
  averages: Averages,
  effects: Effects,
  ext: ExternalBonuses,
  derived: DerivedBonuses,
  drain: number,
): EssenceOutcome {
  const block = BLOCKS[type];

  const armor = Math.max(block.armor - stats.armorPen, 0);
  const avgStun = 1 - block.stunChance * (1 - stats.stunNegate) * block.stunDuration;
  const avgWeaken =
    1 - block.weakenChance * block.weakenDuration + block.weakenChance * block.weakenDuration * block.weakenMulti;
  const avgRegen = block.regen / block.regenInterval;

  const effectiveDamagePerHit =
    (stats.damage - armor) * averages.critMult * avgStun * avgWeaken - avgRegen;

  const unmineable = effectiveDamagePerHit <= 0;
  const hitsToMine = unmineable
    ? Infinity
    : Math.ceil((block.health * averages.brittleMult) / effectiveDamagePerHit);

  const timeToMine = hitsToMine * stats.attackInterval;
  const cycleTime = timeToMine + block.respawn;
  const blocksPerHour = unmineable ? 0 : 3600 / cycleTime;

  const { min, max } = lootRange(type, block, effects, ext, derived);
  const minLootAvg = min + averages.shinyBonus;
  const maxLootAvg = max + averages.shinyBonus;
  // The best single block, for the range the player sees rather than the mean.
  // A bonus that cannot proc is not part of anyone's range, hence the gates.
  const luckiestLoot =
    max +
    (stats.shinyChance > 0 ? stats.shinyBonus : 0) +
    (stats.shinyChance > 0 && stats.superShinyChance > 0 ? stats.superShinyBonus : 0);
  const trueLootAvg = (minLootAvg + maxLootAvg) / 2;
  const essencePerHour = blocksPerHour * trueLootAvg;

  return {
    type,
    armor,
    minLoot: min,
    maxLoot: max,
    avgStun,
    avgWeaken,
    avgRegen,
    effectiveDamagePerHit,
    hitsToMine,
    timeToMine,
    cycleTime,
    blocksPerHour,
    minLootAvg,
    maxLootAvg,
    luckiestLoot,
    trueLootAvg,
    essencePerHour,
    brittleBlocksPerHour: blocksPerHour * stats.brittleChance,
    altarDrain: drain,
    netEssencePerHour: essencePerHour - drain,
    // Overwritten by applySupply, which needs every pool's income at once.
    sustainedNet: essencePerHour - drain,
    unmineable,
  };
}

function computeAltars(
  input: ArcanistInput,
  ext: ExternalBonuses,
  runeCraftMulti: number,
): Record<AltarId, AltarOutcome> {
  const out = {} as Record<AltarId, AltarOutcome>;

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];
    const capacity = clampLevel(raw.capacity, 25);
    const travel = clampLevel(raw.travel, 10);
    const craft = clampLevel(raw.craft, 10);

    const cardBonus = cardValue(CARD_SCALES.altarCraft, ext.cards.rune[id]);

    const cycleTime = def.baseCycle * (1 - travel * ALTAR_TRAVEL_PER_LEVEL) * 2;
    const cyclesPerHour = 3600 / cycleTime;
    const runesPerCycle =
      (1 + capacity) * (1 + craft * ALTAR_CRAFT_PER_LEVEL) * (1 + cardBonus) * runeCraftMulti;

    out[id] = {
      id,
      unlocked: raw.unlocked,
      active: raw.active,
      cycleTime,
      runesPerCycle,
      runesPerHour: cyclesPerHour * runesPerCycle,
      essenceCostPerHour: cyclesPerHour * (1 + capacity),
      // Filled in by applySupply, once essence income is known.
      supplyFactor: 1,
      sustainedRunesPerHour: cyclesPerHour * runesPerCycle,
      consumes: def.consumes,
      rune: def.rune,
    };
  }

  return out;
}

/**
 * Throttle each altar to the essence actually reaching it.
 *
 * An altar stalls on an empty pool, so what it produces over a long run is set
 * by the pool's income, not by its own tuning. Mining is exclusive, so at most
 * one pool has income at a time and the other two support only whatever their
 * altars can draw from a stock that is not being replenished — zero, in the
 * steady state this models.
 *
 * The factor is a ratio rather than a boolean because two altars can share a
 * pool: Ash and Brine both drain Soft, so a pool feeding half their combined
 * demand runs both at half rate rather than one of them fully.
 *
 * Runs after `computeEssence` because it needs income, and income does not
 * depend on drain — only the net does.
 */
function applySupply(
  altars: Record<AltarId, AltarOutcome>,
  essence: Record<EssenceType, EssenceOutcome>,
  drain: Record<EssenceType, number>,
  mining: EssenceType,
): void {
  const factor = {} as Record<EssenceType, number>;
  for (const type of ESSENCE_TYPES) {
    const supply = type === mining ? essence[type].essencePerHour : 0;
    const demand = drain[type];
    factor[type] = demand > 0 ? Math.min(1, supply / demand) : 1;
  }

  for (const id of ALTAR_IDS) {
    const altar = altars[id];
    const share = altar.unlocked && altar.active ? factor[altar.consumes] : 1;
    altar.supplyFactor = share;
    altar.sustainedRunesPerHour = altar.runesPerHour * share;
  }

  for (const type of ESSENCE_TYPES) {
    const outcome = essence[type];
    const supply = type === mining ? outcome.essencePerHour : 0;
    // `supply - demand * factor` algebraically, but that leaves a float residue
    // where it should be a clean zero: below demand, factor is supply/demand
    // and the two terms cancel exactly.
    outcome.sustainedNet = Math.max(0, supply - drain[type]);
  }
}

// ---------------------------------------------------------------------------
// Cost rows
// ---------------------------------------------------------------------------

function costRow(
  id: string,
  label: string,
  level: number,
  max: number,
  cost: (typeof ESSENCE_UPGRADES)[number]['cost'] | undefined,
  effectText: string,
  note?: string,
): UpgradeCost {
  const common = { id, label, level, max, effectText, note, available: level < max };
  const maxed = level >= max;

  // No cost data for this row. Distinct from free.
  if (!cost) return { ...common, next: {}, remaining: {}, total: {}, priced: false };

  if (cost.kind === 'tiered') {
    return {
      ...common,
      next: maxed ? {} : tieredCost(cost.tiers, level, level + 1),
      remaining: tieredCost(cost.tiers, level, max),
      total: tieredCost(cost.tiers, 0, max),
      priced: true,
    };
  }

  return {
    ...common,
    resource: cost.resource,
    next: maxed ? {} : { [cost.resource]: curveCost(cost.curve, level, level + 1) },
    remaining: { [cost.resource]: curveCost(cost.curve, level, max) },
    total: { [cost.resource]: curveCost(cost.curve, 0, max) },
    priced: true,
  };
}

function buildRows(
  input: ArcanistInput,
  spells: Record<SpellId, SpellOutcome>,
): ArcanistResult['rows'] {
  const essence = ESSENCE_UPGRADES.map((def) => {
    const level = clampLevel(input.essence[def.id], def.max);
    const effectText = def.effects
      .map((e) => `${e.label} ${formatEffect(level * e.perLevel, e.display)}`)
      .join(' · ');
    return costRow(def.id, def.label, level, def.max, def.cost, effectText, def.note);
  });

  const altars = {} as Record<AltarId, UpgradeCost[]>;
  const altarUnlocks: UpgradeCost[] = [];

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];

    altars[id] = def.upgrades.map((up) => {
      const level = clampLevel(raw[up.key], up.max);
      const perLevel = up.key === 'travel' ? ALTAR_TRAVEL_PER_LEVEL : ALTAR_CRAFT_PER_LEVEL;
      // Capacity is a count that starts at 1, not a percentage bonus.
      const effectText =
        up.key === 'capacity'
          ? `Holds ${1 + level} essence per cycle`
          : `${up.label} ${formatEffect(level * perLevel, 'percent')}`;
      return costRow(
        `${id}.${up.key}`,
        up.label,
        level,
        up.max,
        { kind: 'curve', resource: up.resource, curve: up.curve },
        effectText,
      );
    });

    if (Object.keys(def.unlockCost).length > 0) {
      altarUnlocks.push({
        id: `${id}.unlock`,
        label: `Unlock ${def.label}`,
        level: raw.unlocked ? 1 : 0,
        max: 1,
        next: raw.unlocked ? {} : { ...def.unlockCost },
        remaining: raw.unlocked ? {} : { ...def.unlockCost },
        total: { ...def.unlockCost },
        effectText: raw.unlocked ? 'Unlocked' : 'Locked',
        available: !raw.unlocked,
        priced: true,
      });
    }
  }

  const spellRows = SPELL_IDS.map((id) => {
    const def = SPELLS[id];
    const outcome = spells[id];
    const rank = clampLevel(input.spells[id].rank, def.maxRank);
    return {
      id: `${id}.potency`,
      label: `${def.label} Potency`,
      level: rank,
      max: def.maxRank,
      resource: def.potencyResource,
      next:
        rank >= def.maxRank ? {} : { [def.potencyResource]: outcome.potencyCostNext },
      remaining: { [def.potencyResource]: outcome.potencyCostRemaining },
      total: { [def.potencyResource]: outcome.potencyCostTotal },
      effectText: `${def.primary.label} ${formatEffect(outcome.primary, def.primary.display)} · ${
        def.secondary.label
      } ${formatEffect(outcome.secondary, def.secondary.display)}`,
      available: rank < def.maxRank,
      priced: true,
    } satisfies UpgradeCost;
  });

  const exchange = EXCHANGE_UPGRADES.map((def) => {
    const level = clampLevel(input.exchange[def.id], def.max);
    const effectText =
      def.perLevel === undefined
        ? level >= def.max
          ? 'Purchased'
          : 'Not purchased'
        : `${def.label} ${formatEffect(level * def.perLevel, def.display ?? 'flat')}`;
    return costRow(def.id, def.label, level, def.max, def.cost, effectText, def.note);
  });

  return { essence, altars, altarUnlocks, spells: spellRows, exchange };
}

function sumTotals(rows: ArcanistResult['rows']): ArcanistResult['totals'] {
  const remaining = emptyResourceRecord();
  const total = emptyResourceRecord();

  const all: UpgradeCost[] = [
    ...rows.essence,
    ...ALTAR_IDS.flatMap((id) => rows.altars[id]),
    ...rows.altarUnlocks,
    ...rows.spells,
    ...rows.exchange,
  ];

  // Which resources the Arcanist can actually spend. Derived rather than
  // listed, so dropping a cost also drops its resource from the totals panel
  // instead of leaving a row stuck at zero forever.
  const spendable = new Set<Resource>();

  for (const row of all) {
    if (!row.priced) continue;
    addBundle(remaining as ResourceBundle, row.remaining);
    addBundle(total as ResourceBundle, row.total);
    for (const resource of Object.keys(row.total) as Resource[]) {
      if ((row.total[resource] ?? 0) > 0) spendable.add(resource);
    }
  }

  return { remaining, total, spendable: RESOURCES.filter((r) => spendable.has(r)) };
}

// ---------------------------------------------------------------------------

export function compute(input: ArcanistInput): ArcanistResult {
  const ext = input.external;
  const derived = deriveBonuses(ext);
  const effects = collectEffects(input);
  const spells = computeSpells(input, ext, derived);

  // Resolve the rune craft multiplier before altars (see module comment).
  const exchangeRuneCraft =
    clampLevel(input.exchange.runeCraftMulti, 15) *
    (EXCHANGE_UPGRADES.find((d) => d.id === 'runeCraftMulti')?.perLevel ?? 0);
  const runeCraftMulti =
    (1 + spells.prismism.secondary + exchangeRuneCraft) *
    (1 + derived.contractRuneCraft) *
    (1 + derived.storeRuneCraft);

  const stats = computeStats(effects, spells, input.exchange, ext, derived);
  const averages = computeAverages(stats);
  const altars = computeAltars(input, ext, runeCraftMulti);

  const drain: Record<EssenceType, number> = { soft: 0, dense: 0, jagged: 0 };
  for (const id of ALTAR_IDS) {
    const altar = altars[id];
    if (altar.active && altar.unlocked) {
      drain[altar.consumes] += altar.essenceCostPerHour;
    }
  }

  const essence = {} as Record<EssenceType, EssenceOutcome>;
  for (const type of ESSENCE_TYPES) {
    essence[type] = computeEssence(type, stats, averages, effects, ext, derived, drain[type]);
  }

  applySupply(altars, essence, drain, input.mining);

  const rows = buildRows(input, spells);

  return {
    stats,
    averages,
    derived,
    runeCraftMulti,
    essence,
    altars,
    spells,
    drain,
    rows,
    totals: sumTotals(rows),
  };
}
