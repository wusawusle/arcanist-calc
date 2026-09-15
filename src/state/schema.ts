/**
 * Serialization for saved builds.
 *
 * Two representations, one source of truth:
 *  - JSON  (export/import, localStorage) — keyed and readable, and migrated
 *    forward when the shape changes so a saved build survives an upgrade.
 *  - packed array (share URLs) — a fixed-order list of numbers, which is what
 *    makes a link short enough to paste. FIELD_ORDER is append-only within a
 *    version: never reorder or remove an entry, or existing links decode to
 *    nonsense. When the order must change, bump PACK_FORMAT so old tokens are
 *    rejected loudly instead.
 */

import {
  ALTAR_IDS,
  CONTRACT_RUNE_CRAFT,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  PET,
  SPELL_IDS,
  UNLOCKS,
} from '../calc/constants';
import { CARD_TIERS, ESSENCE_TYPES, ORB_CARD_IDS } from '../calc/types';
import type {
  AltarId,
  ArcanistInput,
  CardTier,
  EssenceType,
  EssenceUpgradeId,
  ExchangeUpgradeId,
  ExternalBonuses,
  OrbCardId,
  SpellId,
} from '../calc/types';
import { FRESH_INPUT } from '../presets/fresh';

/**
 * 1 — original flat ExternalBonuses (raw numbers like `petBrittle: 0.05`).
 * 2 — cards / pets / unlocks groups, with levels and unlocks as the input.
 * 3 — Exchange trimmed to the two upgrades the Arcanist reads.
 * 4 — `mining`: which essence the Arcanist is currently mining.
 * 5 — restores all thirteen released Exchange upgrades now that their costs are documented.
 *
 * JSON needs no migration for either: parsing walks the definitions it knows
 * and defaults anything absent, so an older export loads with `mining` at its
 * fresh value and newly restored Exchange levels at zero. The packed share
 * format is positional and cannot absorb that, which is why PACK_FORMAT moves
 * alongside.
 */
export const SCHEMA_VERSION = 5;

export interface SavedBuild {
  version: number;
  input: ArcanistInput;
}

// ---------------------------------------------------------------------------
// Coercion — anything coming from disk, a URL or another user is untrusted.
// ---------------------------------------------------------------------------

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const int = (value: unknown, fallback: number): number => Math.trunc(num(value, fallback));

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : value === 1 ? true : value === 0 ? false : fallback;

const tier = (value: unknown, fallback: CardTier): CardTier =>
  typeof value === 'string' && (CARD_TIERS as readonly string[]).includes(value)
    ? (value as CardTier)
    : fallback;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Bring a v1 ExternalBonuses forward.
 *
 * v1 stored the derived numbers; v2 stores what the player owns. Every
 * conversion here is exact — v1's values were themselves computed from these
 * inputs by fixed formulas, so dividing back out recovers the original.
 */
function migrateExternalV1(raw: Record<string, unknown>): unknown {
  const spellCards = asRecord(raw.cardSpell);

  // Pets!E108 = (questLevel * step) + step, so level 0 already grants one step.
  const questShiny = num(raw.petShiny, 0);
  const questSteps = questShiny > 0 ? Math.round(questShiny / PET.questShinyPerStep) : 0;

  const statueSuperShiny = num(raw.constructSuperShiny, 0);

  return {
    cards: {
      essence: {
        soft: raw.cardSoftMaxLoot,
        dense: raw.cardDenseMaxLoot,
        jagged: raw.cardJaggedMaxLoot,
      },
      rune: {
        ash: raw.cardAshCraft,
        brine: raw.cardBrineCraft,
        chasm: raw.cardChasmCraft,
      },
      spell: spellCards,
      // v1 had no orb cards; they were folded into the manual arcaneCardCount.
      orb: {},
    },
    pets: {
      rhinoLevel: Math.round(num(raw.petBrittle, 0) / PET.brittlePerLevel),
      rhinoSkin: bool(raw.petMaxEssence, false),
      rhinoQuestSkin: questSteps > 0,
      rhinoQuestLevel: Math.max(questSteps - 1, 0),
      rhinoCard: raw.cardSuperShiny,
    },
    unlocks: {
      worldQuest25: bool(raw.obeliskShiny, false),
      worldQuest29: bool(raw.obeliskSuperShiny, false),
      // v1 tracked the two halves of this unlock separately.
      straightOuttaYanille: bool(raw.skillShiny, false) || bool(raw.skillBrittle, false),
      arcanistBundle: bool(raw.storeShiny, false),
      statueOfNatureGilded: statueSuperShiny > 0,
      w4GildedStatues: Math.round(statueSuperShiny / UNLOCKS.statueSuperShinyPerStatue),
    },
    contractRuneCraftLevel: Math.round(
      num(raw.contractRuneCraft, 0) / CONTRACT_RUNE_CRAFT.perLevel,
    ),
  };
}

// ---------------------------------------------------------------------------
// Coercion into the current shape
// ---------------------------------------------------------------------------

function coerceExternal(raw: unknown): ExternalBonuses {
  let data = asRecord(raw);
  // A v1 payload has no `cards` group but does have the old flat card fields.
  if (!('cards' in data) && 'cardSoftMaxLoot' in data) {
    data = asRecord(migrateExternalV1(data));
  }

  const cards = asRecord(data.cards);
  const essenceCards = asRecord(cards.essence);
  const runeCards = asRecord(cards.rune);
  const spellCards = asRecord(cards.spell);
  const orbCards = asRecord(cards.orb);
  const pets = asRecord(data.pets);
  const unlocks = asRecord(data.unlocks);

  const essence = {} as Record<EssenceType, CardTier>;
  for (const type of ESSENCE_TYPES) essence[type] = tier(essenceCards[type], 'none');

  const rune = {} as Record<AltarId, CardTier>;
  for (const id of ALTAR_IDS) rune[id] = tier(runeCards[id], 'none');

  const spell = {} as Record<SpellId, CardTier>;
  for (const id of SPELL_IDS) spell[id] = tier(spellCards[id], 'none');

  const orb = {} as Record<OrbCardId, CardTier>;
  for (const id of ORB_CARD_IDS) orb[id] = tier(orbCards[id], 'none');

  return {
    cards: { essence, rune, spell, orb },
    pets: {
      rhinoLevel: clamp(int(pets.rhinoLevel, 0), PET.maxLevel),
      rhinoSkin: bool(pets.rhinoSkin, false),
      rhinoQuestSkin: bool(pets.rhinoQuestSkin, false),
      rhinoQuestLevel: clamp(int(pets.rhinoQuestLevel, 0), PET.maxQuestLevel),
      rhinoCard: tier(pets.rhinoCard, 'none'),
    },
    unlocks: {
      worldQuest25: bool(unlocks.worldQuest25, false),
      worldQuest29: bool(unlocks.worldQuest29, false),
      straightOuttaYanille: bool(unlocks.straightOuttaYanille, false),
      arcanistBundle: bool(unlocks.arcanistBundle, false),
      statueOfNatureGilded: bool(unlocks.statueOfNatureGilded, false),
      w4GildedStatues: clamp(int(unlocks.w4GildedStatues, 0), UNLOCKS.maxW4GildedStatues),
    },
    contractRuneCraftLevel: clamp(
      int(data.contractRuneCraftLevel, 0),
      CONTRACT_RUNE_CRAFT.maxLevel,
    ),
  };
}

/** Rebuild a complete, in-range ArcanistInput from arbitrary input. */
export function coerceInput(raw: unknown): ArcanistInput {
  const data = asRecord(raw);
  const essenceRaw = asRecord(data.essence);
  const altarsRaw = asRecord(data.altars);
  const spellsRaw = asRecord(data.spells);
  const exchangeRaw = asRecord(data.exchange);

  const essence = {} as Record<EssenceUpgradeId, number>;
  for (const def of ESSENCE_UPGRADES) {
    essence[def.id] = clamp(int(essenceRaw[def.id], 0), def.max);
  }

  const altars = {} as Record<AltarId, ArcanistInput['altars'][AltarId]>;
  for (const id of ALTAR_IDS) {
    const src = asRecord(altarsRaw[id]);
    const fallback = FRESH_INPUT.altars[id];
    altars[id] = {
      unlocked: bool(src.unlocked, fallback.unlocked),
      active: bool(src.active, fallback.active),
      capacity: clamp(int(src.capacity, 0), 25),
      travel: clamp(int(src.travel, 0), 10),
      craft: clamp(int(src.craft, 0), 10),
    };
  }

  const spells = {} as Record<SpellId, ArcanistInput['spells'][SpellId]>;
  for (const id of SPELL_IDS) {
    const src = asRecord(spellsRaw[id]);
    spells[id] = {
      unlocked: bool(src.unlocked, false),
      level: clamp(int(src.level, 0), 50),
      rank: clamp(int(src.rank, 0), 10),
    };
  }

  const exchange = {} as Record<ExchangeUpgradeId, number>;
  for (const def of EXCHANGE_UPGRADES) {
    exchange[def.id] = clamp(int(exchangeRaw[def.id], 0), def.max);
  }

  return {
    essence,
    altars,
    spells,
    exchange,
    external: coerceExternal(data.external),
    mining: ESSENCE_TYPES.includes(data.mining as EssenceType)
      ? (data.mining as EssenceType)
      : FRESH_INPUT.mining,
  };
}

// ---------------------------------------------------------------------------
// JSON (export / import / localStorage)
// ---------------------------------------------------------------------------

export function toSavedBuild(input: ArcanistInput): SavedBuild {
  return { version: SCHEMA_VERSION, input };
}

/** Accepts a SavedBuild of any version, a bare ArcanistInput, or junk. */
export function fromSavedBuild(raw: unknown): ArcanistInput {
  const data = asRecord(raw);
  return coerceInput('input' in data ? data.input : data);
}

// ---------------------------------------------------------------------------
// Packed array (share URLs)
// ---------------------------------------------------------------------------

interface Field {
  get: (input: ArcanistInput) => number;
  set: (input: ArcanistInput, value: number) => void;
}

const tierIndex = (t: CardTier) => Math.max(CARD_TIERS.indexOf(t), 0);
const tierAt = (i: number): CardTier => CARD_TIERS[i] ?? 'none';

const cardField = (
  block: keyof ExternalBonuses['cards'],
  key: string,
): Field => ({
  get: (input) =>
    tierIndex((input.external.cards[block] as Record<string, CardTier>)[key] ?? 'none'),
  set: (input, value) => {
    (input.external.cards[block] as Record<string, CardTier>)[key] = tierAt(value);
  },
});

const petField = (key: keyof ExternalBonuses['pets']): Field => ({
  get: (input) => {
    const value = input.external.pets[key];
    return typeof value === 'boolean' ? (value ? 1 : 0) : typeof value === 'number' ? value : 0;
  },
  set: (input, value) => {
    const current = input.external.pets[key];
    if (typeof current === 'boolean') (input.external.pets[key] as boolean) = value === 1;
    else if (typeof current === 'number') (input.external.pets[key] as number) = value;
    else (input.external.pets[key] as CardTier) = tierAt(value);
  },
});

const unlockField = (key: keyof ExternalBonuses['unlocks']): Field => ({
  get: (input) => {
    const value = input.external.unlocks[key];
    return typeof value === 'boolean' ? (value ? 1 : 0) : value;
  },
  set: (input, value) => {
    const current = input.external.unlocks[key];
    if (typeof current === 'boolean') (input.external.unlocks[key] as boolean) = value === 1;
    else (input.external.unlocks[key] as number) = value;
  },
});

/**
 * APPEND-ONLY within a pack format. Adding a field at the end is safe: short
 * arrays decode with defaults for the missing tail. Reordering or removing
 * requires bumping PACK_FORMAT.
 */
const FIELD_ORDER: Field[] = [
  ...ESSENCE_UPGRADES.map(
    (def): Field => ({
      get: (input) => input.essence[def.id],
      set: (input, value) => {
        input.essence[def.id] = value;
      },
    }),
  ),
  ...ALTAR_IDS.flatMap((id): Field[] => [
    {
      get: (input) => (input.altars[id].unlocked ? 1 : 0),
      set: (input, value) => {
        input.altars[id].unlocked = value === 1;
      },
    },
    {
      get: (input) => (input.altars[id].active ? 1 : 0),
      set: (input, value) => {
        input.altars[id].active = value === 1;
      },
    },
    {
      get: (input) => input.altars[id].capacity,
      set: (input, value) => {
        input.altars[id].capacity = value;
      },
    },
    {
      get: (input) => input.altars[id].travel,
      set: (input, value) => {
        input.altars[id].travel = value;
      },
    },
    {
      get: (input) => input.altars[id].craft,
      set: (input, value) => {
        input.altars[id].craft = value;
      },
    },
  ]),
  ...SPELL_IDS.flatMap((id): Field[] => [
    {
      get: (input) => (input.spells[id].unlocked ? 1 : 0),
      set: (input, value) => {
        input.spells[id].unlocked = value === 1;
      },
    },
    {
      get: (input) => input.spells[id].level,
      set: (input, value) => {
        input.spells[id].level = value;
      },
    },
    {
      get: (input) => input.spells[id].rank,
      set: (input, value) => {
        input.spells[id].rank = value;
      },
    },
  ]),
  ...EXCHANGE_UPGRADES.map(
    (def): Field => ({
      get: (input) => input.exchange[def.id],
      set: (input, value) => {
        input.exchange[def.id] = value;
      },
    }),
  ),
  ...ESSENCE_TYPES.map((type) => cardField('essence', type)),
  ...ALTAR_IDS.map((id) => cardField('rune', id)),
  ...SPELL_IDS.map((id) => cardField('spell', id)),
  ...ORB_CARD_IDS.map((id) => cardField('orb', id)),
  petField('rhinoLevel'),
  petField('rhinoSkin'),
  petField('rhinoQuestSkin'),
  petField('rhinoQuestLevel'),
  petField('rhinoCard'),
  unlockField('worldQuest25'),
  unlockField('worldQuest29'),
  unlockField('straightOuttaYanille'),
  unlockField('arcanistBundle'),
  unlockField('statueOfNatureGilded'),
  unlockField('w4GildedStatues'),
  {
    get: (input) => input.external.contractRuneCraftLevel,
    set: (input, value) => {
      input.external.contractRuneCraftLevel = value;
    },
  },
  // An index into ESSENCE_TYPES, as card tiers encode their tier.
  {
    get: (input) => Math.max(ESSENCE_TYPES.indexOf(input.mining), 0),
    set: (input, value) => {
      input.mining = ESSENCE_TYPES[value] ?? FRESH_INPUT.mining;
    },
  },
];

export const PACKED_FIELD_COUNT = FIELD_ORDER.length;

export function packFields(input: ArcanistInput): number[] {
  return FIELD_ORDER.map((field) => field.get(input));
}

export function unpackFields(values: readonly number[]): ArcanistInput {
  const input = structuredClone(FRESH_INPUT);
  FIELD_ORDER.forEach((field, i) => {
    const value = values[i];
    if (typeof value === 'number' && Number.isFinite(value)) field.set(input, value);
  });
  // Run through coercion so out-of-range values in a hand-edited link are clamped.
  return coerceInput(input);
}
