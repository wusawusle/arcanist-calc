/**
 * Static game data for the Arcanist, transcribed from the workbook's Arcanist
 * sheet. Row numbers in comments point back at the source cells.
 *
 * A game balance patch should be fixable by editing this file alone.
 */

import type {
  AltarDef,
  AltarId,
  BlockDef,
  CardTier,
  EssenceType,
  EssenceUpgradeDef,
  ExchangeUpgradeDef,
  Resource,
  SpellDef,
  SpellId,
} from './types';

/** Arcanist base mining stats — hardcoded in the sheet's M2:N17 panel. */
export const BASE_STATS = {
  /** N3: damage is (10 + flat upgrades + arcane cards) * (1 + damage%). */
  baseDamage: 10,
  /** N4: seconds between attacks. */
  attackInterval: 2,
  /** N6: crit damage is 2 * (1 + critDamage effect). */
  critDamage: 2,
  /** N8: super crit damage is 2 * (1 + superCritDamage effect), mirroring N6. */
  superCritDamage: 2,
  /** N9: ultra crit is not in the Arcanist yet, so nothing feeds this. */
  ultraCritChance: 0,
  /** N10. */
  ultraCritDamage: 2,
  /** N14: shiny loot bonus is 3 + the Shiny Essence Loot upgrade. */
  shinyBonusBase: 3,
  /** N16. */
  superShinyBonus: 5,
  /** AA29: brittle blocks take this fraction of nominal health to break. */
  brittleMult: 0.2,
} as const;

export const RESOURCES: readonly Resource[] = [
  'whiteOrb',
  'greenOrb',
  'purpleOrb',
  'orangeOrb',
  'redOrb',
  'ashRune',
  'brineRune',
  'chasmRune',
  'softEssence',
  'denseEssence',
  'stoneVein',
  'scorpioStar',
  'lynxStar',
  'aquariusStar',
  'superstars',
  'prestigePoints',
  'blueCow',
];

export const RESOURCE_LABELS: Record<Resource, string> = {
  whiteOrb: 'White Orb',
  greenOrb: 'Green Orb',
  purpleOrb: 'Purple Orb',
  orangeOrb: 'Orange Orb',
  redOrb: 'Red Orb',
  ashRune: 'Ash Rune',
  brineRune: 'Brine Rune',
  chasmRune: 'Chasm Rune',
  softEssence: 'Soft Essence',
  denseEssence: 'Dense Essence',
  stoneVein: 'Stone Vein',
  scorpioStar: 'Scorpio Star',
  lynxStar: 'Lynx Star',
  aquariusStar: 'Aquarius Star',
  superstars: 'Superstars',
  prestigePoints: 'Prestige Points',
  blueCow: 'Blue Cow',
};

/** Grouping used by the Total Resources panel (A88:A110). */
export const RESOURCE_GROUPS: { label: string; resources: Resource[] }[] = [
  { label: 'Orbs', resources: ['whiteOrb', 'greenOrb', 'purpleOrb', 'orangeOrb', 'redOrb'] },
  { label: 'Runes', resources: ['ashRune', 'brineRune', 'chasmRune'] },
  { label: 'Essence', resources: ['softEssence', 'denseEssence'] },
  { label: 'Veins', resources: ['stoneVein'] },
  { label: 'Stars', resources: ['scorpioStar', 'lynxStar', 'aquariusStar', 'superstars'] },
  { label: 'Misc', resources: ['prestigePoints', 'blueCow'] },
];

export const ESSENCE_LABELS: Record<EssenceType, string> = {
  soft: 'Soft Essence',
  dense: 'Dense Essence',
  jagged: 'Jagged Essence',
};

// ---------------------------------------------------------------------------
// Card tiers
// ---------------------------------------------------------------------------

/**
 * Card cells read
 * `IF(H, polychrome * X13, IF(F, polychrome, IF(D, gilded, IF(B, normal, 0))))`.
 * The B/D/F owned-flags are Normal/Gilded/Polychrome. The H branch is Infernal,
 * which no Arcanist card can be transformed to, so it never fires here.
 */
const cardScale = (normal: number, gilded: number, polychrome: number) =>
  ({ normal, gilded, polychrome }) as const;

export const CARD_SCALES = {
  /** Cards!K422/K423/K424 — Essence Cards, max essence loot. */
  essenceMaxLoot: cardScale(1, 2, 4),
  /** Cards!K429/K430/K431 — Rune Cards, altar craft multiplier. */
  altarCraft: cardScale(0.15, 0.3, 0.5),
  /** Cards!K438..K443 — Spell Cards, spell effect. */
  spell: cardScale(0.1, 0.2, 0.35),
  /** Cards!K446..K451 — Orb Cards, trade multiplier. Unused by the Arcanist. */
  orbTrade: cardScale(0.15, 0.3, 0.5),
  /** Cards!K282 — the Rhino's card. Not one of the counted Arcanist blocks. */
  superShiny: cardScale(0.01, 0.02, 0.04),
} as const;

/**
 * How many owned tiers a card at this tier represents.
 *
 * Tiers are cumulative in game — a Polychrome card means you own Normal,
 * Gilded and Polychrome — which is why the workbook's Cards!K456 counts each
 * of the four tier flags separately. Summing this across the Arcanist's cards
 * reproduces that count.
 */
export const CARD_TIER_COUNT: Record<CardTier, number> = {
  none: 0,
  normal: 1,
  gilded: 2,
  polychrome: 3,
};

export function cardValue(
  scale: (typeof CARD_SCALES)[keyof typeof CARD_SCALES],
  tier: CardTier,
): number {
  switch (tier) {
    case 'none':
      return 0;
    case 'normal':
      return scale.normal;
    case 'gilded':
      return scale.gilded;
    case 'polychrome':
      return scale.polychrome;
  }
}

// ---------------------------------------------------------------------------
// Essence blocks (AB2:AJ22)
// ---------------------------------------------------------------------------

export const BLOCKS: Record<EssenceType, BlockDef> = {
  soft: {
    health: 1000,
    armor: 0,
    respawn: 10,
    stunChance: 0,
    stunDuration: 0,
    regen: 5,
    regenInterval: 10,
    weakenChance: 0,
    weakenMulti: 1,
    weakenDuration: 0,
    baseMinLoot: 1,
    baseMaxLoot: 3,
  },
  dense: {
    health: 2000,
    armor: 5,
    respawn: 12,
    stunChance: 0.05,
    stunDuration: 2,
    regen: 7,
    regenInterval: 10,
    weakenChance: 0,
    weakenMulti: 1,
    weakenDuration: 0,
    baseMinLoot: 1,
    baseMaxLoot: 3,
  },
  jagged: {
    health: 5000,
    armor: 10,
    respawn: 15,
    stunChance: 0.06,
    stunDuration: 3,
    regen: 10,
    regenInterval: 10,
    weakenChance: 0.02,
    weakenMulti: 0.5,
    weakenDuration: 8,
    baseMinLoot: 1,
    baseMaxLoot: 3,
  },
};

// ---------------------------------------------------------------------------
// Essence upgrades (A4:H25)
// ---------------------------------------------------------------------------

const geo = (base: number, ratio: number) => ({ kind: 'geometric' as const, base, ratio });
const arith = (first: number, step: number) => ({ kind: 'arithmetic' as const, first, step });
const curveOn = (resource: Resource, curve: ReturnType<typeof geo> | ReturnType<typeof arith>) =>
  ({ kind: 'curve' as const, resource, curve }) as const;

export const ESSENCE_UPGRADES: EssenceUpgradeDef[] = [
  {
    id: 'essenceMine',
    row: 4,
    label: 'Unlock Next Essence Mine',
    max: 4,
    cost: {
      kind: 'tiered',
      tiers: [{ ashRune: 1000 }, { brineRune: 5000 }, {}, {}],
    },
    effects: [],
    note: 'Mines 3 and 4 are not implemented in game ("Coming Soon") and cost nothing on the sheet.',
  },
  {
    id: 'flatDamage1',
    row: 5,
    label: 'Flat Damage +1',
    max: 25,
    cost: curveOn('whiteOrb', geo(1, 1.2)),
    effects: [{ key: 'flatDamage1', label: 'Flat Damage', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'softMaxLoot',
    row: 6,
    label: 'Soft Essence Max Loot +1',
    max: 3,
    cost: curveOn('whiteOrb', arith(10, 30)),
    effects: [{ key: 'softMaxLoot', label: 'Soft Essence Max Loot', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'shinyChance1',
    row: 7,
    label: 'Essence Shiny Chance +0.30%',
    max: 20,
    cost: curveOn('whiteOrb', geo(3, 1.2)),
    effects: [
      { key: 'shinyChance1', label: 'Essence Shiny Chance', perLevel: 0.003, display: 'percent' },
    ],
  },
  {
    id: 'critChance1',
    row: 8,
    label: 'Crit Chance +0.25% / Crit Damage +1%',
    max: 25,
    cost: curveOn('greenOrb', geo(2, 1.2)),
    effects: [
      { key: 'critChance1', label: 'Crit Chance', perLevel: 0.0025, display: 'percent' },
      { key: 'critDamage', label: 'Crit Damage', perLevel: 0.01, display: 'percent' },
    ],
  },
  {
    id: 'flatDamage2',
    row: 10,
    label: 'Flat Damage +1 / Brittle Chance +0.15%',
    max: 25,
    cost: curveOn('greenOrb', geo(3, 1.2)),
    effects: [
      { key: 'flatDamage2', label: 'Flat Damage', perLevel: 1, display: 'flat' },
      { key: 'brittleChance1', label: 'Brittle Chance', perLevel: 0.0015, display: 'percent' },
    ],
  },
  {
    id: 'denseMaxLoot',
    row: 12,
    label: 'Dense Essence Max Loot +1',
    max: 3,
    cost: curveOn('greenOrb', arith(10, 30)),
    effects: [
      { key: 'denseMaxLoot', label: 'Dense Essence Max Loot', perLevel: 1, display: 'flat' },
    ],
  },
  {
    id: 'armorPen',
    row: 13,
    label: 'Essence Armor Pen +1',
    max: 5,
    cost: curveOn('purpleOrb', arith(5, 5)),
    effects: [{ key: 'armorPen', label: 'Essence Armor Pen', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'superCrit1',
    row: 14,
    label: 'Super Crit Chance +0.50% / Super Crit Damage +1%',
    max: 20,
    cost: curveOn('purpleOrb', geo(5, 1.2)),
    effects: [
      { key: 'superCritChance1', label: 'Super Crit Chance', perLevel: 0.005, display: 'percent' },
      { key: 'superCritDamage', label: 'Super Crit Damage', perLevel: 0.01, display: 'percent' },
    ],
  },
  {
    id: 'flatDamage3',
    row: 16,
    label: 'Flat Damage +1 / Stun Negate Chance +2%',
    max: 10,
    cost: curveOn('purpleOrb', geo(8, 1.2)),
    effects: [
      { key: 'flatDamage3', label: 'Flat Damage', perLevel: 1, display: 'flat' },
      { key: 'stunNegate', label: 'Stun Negate Chance', perLevel: 0.02, display: 'percent' },
    ],
  },
  {
    id: 'damagePct',
    row: 18,
    label: 'Flat Damage +2%',
    max: 20,
    cost: curveOn('whiteOrb', geo(3, 1.2)),
    effects: [{ key: 'damagePct', label: 'Flat Damage', perLevel: 0.02, display: 'percent' }],
  },
  {
    id: 'shinyLoot',
    row: 19,
    label: 'Shiny Essence Loot +1',
    max: 3,
    cost: curveOn('greenOrb', arith(15, 15)),
    effects: [{ key: 'shinyLoot', label: 'Shiny Essence Loot', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'shinyChance2',
    row: 20,
    label: 'Shiny Chance +1% / Brittle Chance +1%',
    max: 3,
    cost: curveOn('purpleOrb', arith(20, 20)),
    effects: [
      { key: 'shinyChance2', label: 'Shiny Chance', perLevel: 0.01, display: 'percent' },
      { key: 'brittleChance2', label: 'Brittle Chance', perLevel: 0.01, display: 'percent' },
    ],
  },
  {
    id: 'critChance2',
    row: 22,
    label: 'Crit Chance +0.35% / Super Crit Chance +0.25%',
    max: 20,
    cost: curveOn('orangeOrb', geo(3, 1.2)),
    effects: [
      { key: 'critChance2', label: 'Crit Chance', perLevel: 0.0035, display: 'percent' },
      { key: 'superCritChance2', label: 'Super Crit Chance', perLevel: 0.0025, display: 'percent' },
    ],
  },
  {
    id: 'jaggedLoot',
    row: 24,
    label: 'Jagged Essence Min +1 / Max +1 Loot',
    max: 2,
    cost: curveOn('whiteOrb', arith(20, 20)),
    effects: [
      { key: 'jaggedMinLoot', label: 'Jagged Essence Min Loot', perLevel: 1, display: 'flat' },
      { key: 'jaggedMaxLoot', label: 'Jagged Essence Max Loot', perLevel: 1, display: 'flat' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Altars (A27:L41)
// ---------------------------------------------------------------------------

const altarUpgrades = (
  capacityResource: Resource,
  capacityPer: number,
  travelResource: Resource,
  travelPer: number,
  craftResource: Resource,
) => [
  {
    key: 'capacity' as const,
    label: 'Capacity',
    max: 25,
    resource: capacityResource,
    curve: arith(capacityPer, 0),
  },
  {
    key: 'travel' as const,
    label: 'Travel Time',
    max: 10,
    resource: travelResource,
    curve: arith(travelPer, 0),
  },
  {
    key: 'craft' as const,
    label: 'Craft Multi',
    max: 10,
    resource: craftResource,
    curve: arith(10, 3),
  },
];

export const ALTARS: Record<AltarId, AltarDef> = {
  ash: {
    id: 'ash',
    label: 'Ash Altar',
    baseCycle: 60,
    rune: 'ashRune',
    consumes: 'soft',
    unlockCost: {},
    upgrades: altarUpgrades('whiteOrb', 3, 'whiteOrb', 4, 'whiteOrb'),
  },
  brine: {
    id: 'brine',
    label: 'Brine Altar',
    baseCycle: 90,
    rune: 'brineRune',
    consumes: 'soft',
    unlockCost: { ashRune: 1000 },
    upgrades: altarUpgrades('whiteOrb', 4, 'whiteOrb', 5, 'greenOrb'),
  },
  chasm: {
    id: 'chasm',
    label: 'Chasm Altar',
    baseCycle: 120,
    rune: 'chasmRune',
    consumes: 'dense',
    unlockCost: { ashRune: 5000, brineRune: 2500 },
    upgrades: altarUpgrades('whiteOrb', 5, 'greenOrb', 5, 'purpleOrb'),
  },
};

export const ALTAR_IDS: readonly AltarId[] = ['ash', 'brine', 'chasm'];

/** Per level: travel time reduces cycle length, craft multi raises output. */
export const ALTAR_TRAVEL_PER_LEVEL = 0.05;
export const ALTAR_CRAFT_PER_LEVEL = 0.2;

// ---------------------------------------------------------------------------
// Spells (A42:L66)
// ---------------------------------------------------------------------------

export const SPELLS: Record<SpellId, SpellDef> = {
  runicSurge: {
    id: 'runicSurge',
    label: 'Runic Surge',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'ashRune',
    potencyCurve: geo(2000, 1.25),
    primary: { label: 'Drone Exp Gain', base: 0.15, display: 'percent' },
    secondary: {
      label: 'Essence Shiny Chance',
      base: 0.01,
      display: 'percent',
      feedsBack: true,
    },
    castCost: { ashRune: 5, brineRune: 1 },
    manaCost: 1,
    durationBase: 300,
  },
  rainbowRift: {
    id: 'rainbowRift',
    label: 'Rainbow Rift',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'brineRune',
    potencyCurve: geo(3500, 1.25),
    primary: { label: 'Rainbow Portal Multi', base: 0.2, display: 'percent' },
    secondary: { label: 'Void Portal Chance', base: 0.01, display: 'percent' },
    castCost: { ashRune: 16, brineRune: 8 },
    manaCost: 3,
    durationBase: 300,
  },
  manaflow: {
    id: 'manaflow',
    label: 'Manaflow',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'chasmRune',
    potencyCurve: geo(2500, 1.25),
    primary: { label: 'Mana Regeneration', base: 0.4, display: 'percent' },
    secondary: { label: 'Mana Capacity', base: 0.1, display: 'percent' },
    castCost: { brineRune: 15, chasmRune: 5 },
    manaCost: 4,
    durationBase: 480,
  },
  radiancy: {
    id: 'radiancy',
    label: 'Radiancy',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'ashRune',
    potencyCurve: geo(4000, 1.25),
    primary: { label: 'Star Radiant Chance', base: 0.03, display: 'percent' },
    secondary: { label: 'Star Radiant Multi', base: 0.1, display: 'percent' },
    castCost: { ashRune: 25, brineRune: 10 },
    manaCost: 4,
    durationBase: 360,
  },
  prismism: {
    id: 'prismism',
    label: 'Prismism',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'brineRune',
    potencyCurve: geo(2750, 1.25),
    primary: { label: 'Prismatic Floor Chance', base: 0.07, display: 'percent' },
    secondary: {
      label: 'Rune Craft Multi',
      base: 0.15,
      display: 'percent',
      feedsBack: true,
    },
    castCost: { ashRune: 12, brineRune: 12 },
    manaCost: 3,
    durationBase: 400,
  },
  veinboyant: {
    id: 'veinboyant',
    label: 'Veinboyant',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'brineRune',
    potencyCurve: geo(4000, 1.25),
    primary: { label: 'Rainbow Vein Chance', base: 0.05, display: 'percent' },
    secondary: { label: 'Rainbow Vein Multi', base: 0.15, display: 'percent' },
    castCost: { ashRune: 20, brineRune: 10 },
    manaCost: 3,
    durationBase: 360,
  },
};

export const SPELL_IDS: readonly SpellId[] = [
  'runicSurge',
  'rainbowRift',
  'manaflow',
  'radiancy',
  'prismism',
  'veinboyant',
];

export const SPELL_LEVEL_PER_RANK = 0.05;

// ---------------------------------------------------------------------------
// Exchange
// ---------------------------------------------------------------------------

/**
 * Released Exchange upgrades and their currently documented in-game costs.
 *
 * The original workbook carried guessed Exchange prices, so the first version
 * of this app deliberately removed them. The Arcanist wiki now publishes the
 * actual cost tables; these curves are transcribed from that 2026-09-12 page.
 * Only `arcaneCardDamage` and `runeCraftMulti` feed this calculator's mining
 * equations, but every released row is included because all thirteen consume
 * resources that belong in a complete Arcanist plan.
 */
export const EXCHANGE_UPGRADES: ExchangeUpgradeDef[] = [
  {
    id: 'exchangeWizards',
    row: 69,
    label: 'Exchange Wizards +1',
    max: 3,
    cost: {
      kind: 'tiered',
      tiers: [{ ashRune: 2500 }, { brineRune: 2500 }, { chasmRune: 2500 }],
    },
    perLevel: 1,
    display: 'flat',
  },
  {
    id: 'exchangeTimer',
    row: 70,
    label: 'Exchange Timer -2 Minutes',
    max: 30,
    cost: curveOn('blueCow', arith(500, 500)),
    perLevel: -2,
    display: 'flat',
  },
  {
    id: 'arcaneCardDamage',
    row: 71,
    label: 'Essence Damage Per Arcane Card',
    max: 1,
    cost: curveOn('scorpioStar', arith(10e12, 0)),
    note: 'Grants flat damage equal to your total Arcane card count (External Bonuses).',
  },
  {
    id: 'rainbowFloorMulti',
    row: 72,
    label: 'Rainbow Floor Multi',
    max: 20,
    cost: curveOn('ashRune', geo(250, 1.3)),
    perLevel: 0.02,
    display: 'percent',
  },
  {
    id: 'lootbugBankedCap',
    row: 73,
    label: 'Lootbug Banked Cap',
    max: 10,
    cost: curveOn('prestigePoints', geo(10e24, 1.3)),
    perLevel: 1,
    display: 'flat',
  },
  {
    id: 'goldenPortalChance',
    row: 74,
    label: 'Golden Portal Chance',
    max: 25,
    cost: curveOn('brineRune', geo(175, 1.3)),
    perLevel: 0.002,
    display: 'percent',
  },
  {
    id: 'starSupergiantMulti',
    row: 75,
    label: 'Star Supergiant Multi',
    max: 25,
    cost: curveOn('lynxStar', geo(25e12, 1.3)),
    perLevel: 0.01,
    display: 'percent',
  },
  {
    id: 'wizardLootMulti',
    row: 76,
    label: 'Wizard Loot Multi',
    max: 10,
    cost: curveOn('softEssence', geo(750, 1.25)),
    perLevel: 0.03,
    display: 'percent',
  },
  {
    id: 'geminiStarCap',
    row: 77,
    label: 'Gemini Star Cap',
    // The summary table says 20, but the detailed cost table ends at 10 and
    // gives its total there. Use the priced levels rather than inventing 11-20.
    max: 10,
    cost: curveOn('superstars', geo(500e6, 1.3)),
    perLevel: 2,
    display: 'flat',
  },
  {
    id: 'veinboyantUnlock',
    row: 78,
    label: 'Unlock Spell: Veinboyant',
    max: 1,
    cost: curveOn('stoneVein', arith(50e21, 0)),
    note: 'Unlocks Veinboyant in the Spells menu.',
  },
  {
    id: 'prismaticFloorChance',
    row: 79,
    label: 'Prismatic Floor Chance',
    max: 15,
    cost: curveOn('chasmRune', geo(500, 1.3)),
    perLevel: 0.005,
    display: 'percent',
  },
  {
    id: 'shinyFishMulti',
    row: 80,
    label: 'Shiny Fish Multiplier',
    max: 20,
    cost: curveOn('aquariusStar', geo(100e12, 1.3)),
    perLevel: 0.02,
    display: 'percent',
  },
  {
    id: 'runeCraftMulti',
    row: 81,
    label: 'Rune Craft Multiplier',
    max: 15,
    cost: curveOn('denseEssence', geo(500, 1.25)),
    perLevel: 0.01,
    display: 'percent',
  },
];

// ---------------------------------------------------------------------------
// External bonuses
// ---------------------------------------------------------------------------

/** The Rhino, the Arcanist's pet. */
export const PET = {
  /** Pets!B37. */
  maxLevel: 20,
  /** Pets!E38 = A37 * 0.01 — Essence Brittle Chance per level. */
  brittlePerLevel: 0.01,
  /** Pets!E57 — the Rhino Skin's flat Essence Max Loot bonus. */
  skinMaxLoot: 1,
  /** Pets!B108. */
  maxQuestLevel: 11,
  /**
   * Pets!E108/E109 = (level * step) + step, so level 0 already grants one
   * step and level 11 grants twelve.
   */
  questShinyPerStep: 0.005,
  questSpellPowerPerStep: 0.015,
} as const;

/** One-off account unlocks. */
export const UNLOCKS = {
  /** Obelisks!H28. */
  worldQuest25Shiny: 0.01,
  /** Obelisks!H32. */
  worldQuest29SuperShiny: 0.02,
  /** Skills!D158 / D159. Its mana regen bonus is not modelled. */
  yanilleShiny: 0.01,
  yanilleBrittle: 0.01,
  /** Store!J111..J114. Its wizard loot bonus is not modelled. */
  bundleShiny: 0.01,
  bundleRuneCraft: 0.1,
  bundleSpellDuration: 0.1,
  /** Construct!M352 = 0.01 * E554, gated on the gilded Statue of Nature. */
  statueSuperShinyPerStatue: 0.01,
  /** Nine gildable statues in W4, the Statue of Nature itself included. */
  maxW4GildedStatues: 9,
} as const;

/** Contracts!A45 / D45 = A45 * 0.005. */
export const CONTRACT_RUNE_CRAFT = {
  maxLevel: 19,
  perLevel: 0.005,
} as const;
