/**
 * Domain types for the Arcanist calculator.
 *
 * Provenance notes throughout the calc module refer to cells on the "Arcanist"
 * sheet of the Obelisk Total Resources Calculator workbook (see README).
 */

export type EssenceType = 'soft' | 'dense' | 'jagged';

export const ESSENCE_TYPES: readonly EssenceType[] = ['soft', 'dense', 'jagged'];

export type Resource =
  | 'whiteOrb'
  | 'greenOrb'
  | 'purpleOrb'
  | 'orangeOrb'
  | 'redOrb'
  | 'ashRune'
  | 'brineRune'
  | 'chasmRune'
  | 'softEssence'
  | 'denseEssence'
  | 'stoneVein'
  | 'scorpioStar'
  | 'lynxStar'
  | 'aquariusStar'
  | 'superstars'
  | 'prestigePoints'
  | 'blueCow';

export type AltarId = 'ash' | 'brine' | 'chasm';

export type SpellId =
  | 'runicSurge'
  | 'rainbowRift'
  | 'manaflow'
  | 'radiancy'
  | 'prismism'
  | 'veinboyant';

export type EssenceUpgradeId =
  | 'essenceMine'
  | 'flatDamage1'
  | 'softMaxLoot'
  | 'shinyChance1'
  | 'critChance1'
  | 'flatDamage2'
  | 'denseMaxLoot'
  | 'armorPen'
  | 'superCrit1'
  | 'flatDamage3'
  | 'damagePct'
  | 'shinyLoot'
  | 'shinyChance2'
  | 'critChance2'
  | 'jaggedLoot';

/**
 * The thirteen currently released Exchange upgrades.
 *
 * Only `arcaneCardDamage` and `runeCraftMulti` feed the mining/altar equations,
 * but all thirteen are real Arcanist purchases and the current wiki documents
 * their costs. Keeping them here makes the resource planner complete even when
 * an upgrade affects another game system rather than a number on this page.
 */
export type ExchangeUpgradeId =
  | 'exchangeWizards'
  | 'exchangeTimer'
  | 'arcaneCardDamage'
  | 'rainbowFloorMulti'
  | 'lootbugBankedCap'
  | 'goldenPortalChance'
  | 'starSupergiantMulti'
  | 'wizardLootMulti'
  | 'geminiStarCap'
  | 'veinboyantUnlock'
  | 'prismaticFloorChance'
  | 'shinyFishMulti'
  | 'runeCraftMulti';

/** Effects granted by essence upgrades. Several upgrades grant two. */
export type EffectKey =
  | 'flatDamage1'
  | 'flatDamage2'
  | 'flatDamage3'
  | 'damagePct'
  | 'softMaxLoot'
  | 'denseMaxLoot'
  | 'jaggedMinLoot'
  | 'jaggedMaxLoot'
  | 'shinyChance1'
  | 'shinyChance2'
  | 'shinyLoot'
  | 'critChance1'
  | 'critChance2'
  | 'critDamage'
  | 'superCritChance1'
  | 'superCritChance2'
  | 'superCritDamage'
  | 'brittleChance1'
  | 'brittleChance2'
  | 'armorPen'
  | 'stunNegate';

/**
 * Card tiers, named as the game names them.
 *
 * The workbook encodes these as independent owned-flags per card (columns
 * A/C/E on the Cards sheet, labelled Card / Gild / Polychrome) and takes the
 * highest owned. A single tier picker assumes you own every tier up to the one
 * selected, which is how the source workbook's own data is filled in.
 *
 * The sheet also carries a fourth branch (column G, Infernal, worth the
 * Polychrome value scaled by Cards!X13). No Arcanist card can be transformed
 * to Infernal, so that branch can never fire here and is not modelled — the
 * Infernal cards a player owns come from other parts of the game.
 */
export type CardTier = 'none' | 'normal' | 'gilded' | 'polychrome';

/** Order matters: the index is what share links encode. */
export const CARD_TIERS: readonly CardTier[] = ['none', 'normal', 'gilded', 'polychrome'];

// ---------------------------------------------------------------------------
// Cost curves
// ---------------------------------------------------------------------------

/**
 * Every non-tiered cost in the sheet reduces to one of these two shapes.
 * Both are evaluated in closed form so a goal-seek can call them in a hot loop.
 *
 * - geometric:  cost of level i is `base * ratio^(i-1)`
 * - arithmetic: cost of level i is `first + (i-1) * step`
 *
 * Flat one-off unlocks are `arithmetic` with step 0 and max 1; the altars'
 * fixed per-level costs are `arithmetic` with step 0; the Exchange Timer's
 * `sum(i * 500)` is `arithmetic` with first === step === 500.
 */
export type CostCurve =
  | { kind: 'geometric'; base: number; ratio: number }
  | { kind: 'arithmetic'; first: number; step: number };

/** A cost paid once when crossing into a given level, in one or more resources. */
export type ResourceBundle = Partial<Record<Resource, number>>;

/** Costs that are a fixed bundle per level rather than a curve (rune unlocks). */
export interface TieredCost {
  kind: 'tiered';
  /** tiers[i] is the cost to go from level i to level i+1. */
  tiers: ResourceBundle[];
}

export type CostSpec = ({ kind: 'curve'; resource: Resource } & { curve: CostCurve }) | TieredCost;

// ---------------------------------------------------------------------------
// Definitions (static game data)
// ---------------------------------------------------------------------------

export interface EffectDef {
  key: EffectKey;
  label: string;
  perLevel: number;
  display: 'flat' | 'percent';
}

export interface EssenceUpgradeDef {
  id: EssenceUpgradeId;
  /** Row on the Arcanist sheet, for provenance. */
  row: number;
  label: string;
  max: number;
  cost: CostSpec;
  effects: EffectDef[];
  note?: string;
}

export interface AltarUpgradeDef {
  key: 'capacity' | 'travel' | 'craft';
  label: string;
  max: number;
  resource: Resource;
  curve: CostCurve;
}

export interface AltarDef {
  id: AltarId;
  label: string;
  /** Seconds; cycle time is `baseCycle * (1 - travel*0.05) * 2`. */
  baseCycle: number;
  rune: Resource;
  /** Which essence pool this altar drains while active. */
  consumes: EssenceType;
  unlockCost: ResourceBundle;
  upgrades: AltarUpgradeDef[];
}

export interface SpellEffectDef {
  label: string;
  base: number;
  display: 'flat' | 'percent';
  /** True when this effect feeds back into Arcanist's own numbers. */
  feedsBack?: boolean;
}

export interface SpellDef {
  id: SpellId;
  label: string;
  maxLevel: number;
  maxRank: number;
  potencyResource: Resource;
  potencyCurve: CostCurve;
  primary: SpellEffectDef;
  secondary: SpellEffectDef;
  castCost: ResourceBundle;
  manaCost: number;
  durationBase: number;
}

/** One released Exchange upgrade and its documented purchase curve. */
export interface ExchangeUpgradeDef {
  id: ExchangeUpgradeId;
  row: number;
  label: string;
  max: number;
  cost: CostSpec;
  /** Effect per level; omitted for pure unlocks / one-off purchases. */
  perLevel?: number;
  display?: 'flat' | 'percent';
  note?: string;
}

/** Stats of the essence block you mine, per essence. Game constants — not user input. */
export interface BlockDef {
  health: number;
  armor: number;
  respawn: number;
  stunChance: number;
  stunDuration: number;
  regen: number;
  regenInterval: number;
  weakenChance: number;
  weakenMulti: number;
  weakenDuration: number;
  baseMinLoot: number;
  baseMaxLoot: number;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface AltarInput {
  unlocked: boolean;
  active: boolean;
  capacity: number;
  travel: number;
  craft: number;
}

export interface SpellInput {
  unlocked: boolean;
  level: number;
  rank: number;
}

/** The six Orb Trade cards (Cards rows 446-451). */
export type OrbCardId = 'white' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';

export const ORB_CARD_IDS: readonly OrbCardId[] = [
  'white',
  'green',
  'purple',
  'orange',
  'red',
  'yellow',
];

/**
 * The Arcanist's own card collection (Cards rows 422-451).
 *
 * Only released slots are modelled. The workbook carries two more essence and
 * four more rune slots marked "???"; they cannot be owned, so including them
 * would only offer a tier picker for a card that does not exist.
 *
 * Orb Trade cards change no Arcanist maths, but they are Arcanist cards and so
 * count toward Essence Damage Per Arcane Card — which is why they are here.
 */
export interface CardCollection {
  /** Cards!K422/K423/K424 — max essence loot per type. */
  essence: Record<EssenceType, CardTier>;
  /** Cards!K429/K430/K431 — altar craft multiplier. */
  rune: Record<AltarId, CardTier>;
  /** Cards!K438..K443 — per-spell effect multiplier. */
  spell: Record<SpellId, CardTier>;
  /** Cards!K446..K451 — orb trade multiplier; no effect on the Arcanist. */
  orb: Record<OrbCardId, CardTier>;
}

/** The Rhino, the Arcanist's pet (Pets rows 37-108, Cards!K282). */
export interface PetBonuses {
  /** Pets!A37, max 20. Each level is +1% Essence Brittle Chance. */
  rhinoLevel: number;
  /** Pets!A57 — the Rhino Skin, worth +1 Essence Max Loot. */
  rhinoSkin: boolean;
  /** Pets!A75 — whether the Rhino Quest Skin is unlocked at all. */
  rhinoQuestSkin: boolean;
  /** Pets!A108, max 11. Level 0 already grants the first step. */
  rhinoQuestLevel: number;
  /** Cards!K282 — the Rhino's card. Grants Essence Super Shiny Chance. */
  rhinoCard: CardTier;
}

/** One-off account unlocks that feed the Arcanist. */
export interface UnlockBonuses {
  /** Obelisks!H28 — +1% Essence Shiny Chance. */
  worldQuest25: boolean;
  /** Obelisks!H32 — +2% Essence Super Shiny Chance. */
  worldQuest29: boolean;
  /** Skills!A157 — +1% shiny, +1% brittle (and mana regen, which is unmodelled). */
  straightOuttaYanille: boolean;
  /** Store!G111 — +1% shiny, +10% rune craft, +10% spell duration, +10% wizard loot. */
  arcanistBundle: boolean;
  /** Construct!I350 — enables the per-statue super shiny bonus below. */
  statueOfNatureGilded: boolean;
  /** Construct!E554 — W4 gilded statues owned; +1% super shiny each. */
  w4GildedStatues: number;
}

/**
 * Everything the Arcanist reads from elsewhere in the game.
 *
 * Modelled as the player-facing thing that grants the bonus — a pet level, an
 * unlock, a card tier — rather than the derived number the workbook stored, so
 * it can be filled in by looking at the game instead of at cell references.
 */
export interface ExternalBonuses {
  cards: CardCollection;
  pets: PetBonuses;
  unlocks: UnlockBonuses;
  /** Contracts!A45, max 19. Each level is +0.5% Rune Craft Multi. */
  contractRuneCraftLevel: number;
}

export interface ArcanistInput {
  essence: Record<EssenceUpgradeId, number>;
  altars: Record<AltarId, AltarInput>;
  spells: Record<SpellId, SpellInput>;
  exchange: Record<ExchangeUpgradeId, number>;
  external: ExternalBonuses;
  /**
   * Which essence the Arcanist is currently mining.
   *
   * The Arcanist mines one essence at a time. Every essence still reports its
   * own income — that is what makes the other two answerable as "if you
   * switched" — but only this one is actually being earned, and only this one
   * can keep an altar fed.
   */
  mining: EssenceType;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Arcanist mining stats — the sheet's M2:N17 panel. */
export interface Stats {
  damage: number;
  attackInterval: number;
  critChance: number;
  critDamage: number;
  superCritChance: number;
  superCritDamage: number;
  ultraCritChance: number;
  ultraCritDamage: number;
  armorPen: number;
  stunNegate: number;
  shinyChance: number;
  shinyBonus: number;
  superShinyChance: number;
  superShinyBonus: number;
  brittleChance: number;
}

/** One weighted outcome in a probability table (the sheet's Y/Z/AA columns). */
export interface WeightedOutcome {
  label: string;
  chance: number;
  value: number;
}

export interface Averages {
  shinyTable: WeightedOutcome[];
  /** Z10 — expected bonus loot per block from shiny procs. */
  shinyBonus: number;
  critTable: WeightedOutcome[];
  /** Z23 — expected damage multiplier. */
  critMult: number;
  brittleTable: WeightedOutcome[];
  /** Z33 — expected fraction of nominal health that must be dealt. */
  brittleMult: number;
}

export interface EssenceOutcome {
  type: EssenceType;
  /** Block stats after upgrades and player mitigations. */
  armor: number;
  minLoot: number;
  maxLoot: number;
  avgStun: number;
  avgWeaken: number;
  avgRegen: number;
  effectiveDamagePerHit: number;
  hitsToMine: number;
  timeToMine: number;
  cycleTime: number;
  blocksPerHour: number;
  minLootAvg: number;
  maxLootAvg: number;
  /**
   * The most a single block can drop: a top roll that also procs super shiny.
   *
   * Above `maxLoot`, because shiny is added on top of the roll rather than
   * being part of it. Each bonus is only counted where its chance is non-zero,
   * so a player with no super shiny source is not shown a number they cannot
   * hit. This is the top of the range a player actually observes, which is why
   * it is here rather than left as `maxLoot` — that one is only the roll.
   */
  luckiestLoot: number;
  trueLootAvg: number;
  essencePerHour: number;
  brittleBlocksPerHour: number;
  altarDrain: number;
  /**
   * Income less the full altar drain.
   *
   * Kept as the workbook computes it, and still asserted against the sheet, so
   * the golden test stays a transcription check. It can go negative, which the
   * game cannot: altars stall rather than overdraw a pool. Use `sustainedNet`
   * for anything user-facing.
   */
  netEssencePerHour: number;
  /**
   * Steady-state net, once altars have throttled to what the pool can feed.
   *
   * Zero for an essence you are not mining but whose altars are running: they
   * drain the stock, then stall. Equal to `netEssencePerHour` whenever the pool
   * is being mined faster than it is drained. Never negative — a pool cannot
   * lose more per hour than it holds, and the transient draw-down is the
   * potency path's business, not the steady state's.
   */
  sustainedNet: number;
  /** True when damage output cannot outpace the block's regeneration. */
  unmineable: boolean;
}

export interface AltarOutcome {
  id: AltarId;
  unlocked: boolean;
  active: boolean;
  cycleTime: number;
  runesPerCycle: number;
  /** Rate with essence assumed infinite. What the altar would do if fed. */
  runesPerHour: number;
  essenceCostPerHour: number;
  /**
   * Share of its nominal rate this altar can actually sustain, 0..1.
   *
   * An altar stalls on an empty pool, so its long-run output is capped by what
   * you mine, not by how well it is tuned. 1 means the pool it drains is being
   * mined faster than the altars on it consume — the case the model assumed
   * everywhere before this existed.
   */
  supplyFactor: number;
  /** `runesPerHour * supplyFactor`. The rate a plan can count on. */
  sustainedRunesPerHour: number;
  consumes: EssenceType;
  rune: Resource;
}

export interface SpellOutcome {
  id: SpellId;
  unlocked: boolean;
  primary: number;
  secondary: number;
  duration: number;
  /** Cost of the next potency rank alone. Zero at max rank. */
  potencyCostNext: number;
  potencyCostRemaining: number;
  potencyCostTotal: number;
  potencyResource: Resource;
}

/** A single purchasable row, as the UI and the future optimizer both need it. */
export interface UpgradeCost {
  id: string;
  label: string;
  level: number;
  max: number;
  /** Undefined for tiered rune costs, which span several resources. */
  resource?: Resource;
  /**
   * Cost of the single next level, `level` to `level + 1`.
   *
   * The number a player can act on today, as distinct from `remaining`, which
   * is the whole run to max. Empty at max level, where there is no next level.
   */
  next: ResourceBundle;
  /** Empty for rows with no known cost (every Exchange upgrade). */
  remaining: ResourceBundle;
  total: ResourceBundle;
  /** False when this row has no cost data at all, rather than a cost of zero. */
  priced: boolean;
  /** Human-readable effect at the current level. */
  effectText: string;
  note?: string;
  available: boolean;
}

/**
 * External bonuses, resolved from what the player owns into the numbers the
 * rest of the calculation consumes.
 *
 * The workbook stored these as opaque values (`petBrittle: 0.05`); here the
 * input is the pet level and this is where it becomes a percentage, so a
 * balance change is a constants edit rather than a hunt through the model.
 */
export interface DerivedBonuses {
  /** Sum of owned card tiers across the Arcanist's blocks (Cards!K456). */
  arcaneCardCount: number;
  /** Pets!E38. */
  petBrittle: number;
  /** Pets!E108. */
  petQuestShiny: number;
  /** Pets!E109 — the Arcanist Spell Power multiplier. */
  petSpellPower: number;
  /** Pets!E57. */
  petMaxEssenceLoot: number;
  /** Construct!M352. */
  statueSuperShiny: number;
  /** Statmath!C368. */
  spellDurationMulti: number;
  /** The additive rune craft terms from outside the Arcanist. */
  storeRuneCraft: number;
  contractRuneCraft: number;
}

export interface ArcanistResult {
  stats: Stats;
  averages: Averages;
  /** External bonuses resolved from owned levels/unlocks into usable numbers. */
  derived: DerivedBonuses;
  /** Rune craft multiplier (Statmath!C372), resolved before altar output. */
  runeCraftMulti: number;
  essence: Record<EssenceType, EssenceOutcome>;
  altars: Record<AltarId, AltarOutcome>;
  spells: Record<SpellId, SpellOutcome>;
  drain: Record<EssenceType, number>;
  /** Per-row costs, grouped by section, in sheet order. */
  rows: {
    essence: UpgradeCost[];
    altars: Record<AltarId, UpgradeCost[]>;
    altarUnlocks: UpgradeCost[];
    spells: UpgradeCost[];
    exchange: UpgradeCost[];
  };
  /** Totals by resource, summed across every priced row. */
  totals: {
    remaining: Record<Resource, number>;
    total: Record<Resource, number>;
    /** Resources that some priced upgrade actually costs, in canonical order. */
    spendable: Resource[];
  };
}
