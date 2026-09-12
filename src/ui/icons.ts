/**
 * Game icons, vendored from the Idle Obelisk Miner wiki into public/icons/.
 *
 * They are served from this origin rather than hotlinked: the set is only
 * ~300 KB, and hotlinking would leave the whole UI dependent on a third-party
 * host staying up and permitting it.
 *
 * Sources are recorded in ICON-CREDITS.md. To add one, drop the PNG in
 * public/icons/ and add a line here — the key is what the UI refers to.
 */

import type {
  AltarId,
  CardTier,
  EssenceType,
  EssenceUpgradeId,
  ExchangeUpgradeId,
  OrbCardId,
  Resource,
  SpellId,
} from '../calc/types';

/** Vite serves public/ at the configured base path. */
const base = `${import.meta.env.BASE_URL}icons/`;
const icon = (file: string) => `${base}${file}`;

export const ESSENCE_ICONS: Record<EssenceType, string> = {
  soft: icon('Soft_Essence.png'),
  dense: icon('Dense_Essence.png'),
  jagged: icon('Jagged_Essence.png'),
};

export const SECTION_ICONS = {
  essence: icon('Essence.png'),
  spells: icon('Spells.png'),
  altars: icon('Altars.png'),
  exchange: icon('Exchange_Wizard.png'),
  cards: icon('Card_Backing_Polychrome.png'),
  pets: icon('Rhino_Default.png'),
  unlocks: icon('Spell_Unlock.png'),
  contracts: icon('Rune_Craft_Multi.png'),
} as const;

/** Only resources the Arcanist can actually spend have icons. */
export const RESOURCE_ICONS: Partial<Record<Resource, string>> = {
  whiteOrb: icon('White_Orb.png'),
  greenOrb: icon('Green_Orb.png'),
  purpleOrb: icon('Purple_Orb.png'),
  orangeOrb: icon('Orange_Orb.png'),
  redOrb: icon('Red_Orb.png'),
  ashRune: icon('Ash_Rune.png'),
  brineRune: icon('Brine_Rune.png'),
  chasmRune: icon('Chasm_Rune.png'),
  softEssence: icon('Soft_Essence.png'),
  denseEssence: icon('Dense_Essence.png'),
};

export const ALTAR_ICONS: Record<AltarId, string> = {
  ash: icon('Ash_Rune.png'),
  brine: icon('Brine_Rune.png'),
  chasm: icon('Chasm_Rune.png'),
};

/** The spell item itself, shown on spell rows you have not unlocked yet. */
export const SPELL_ICONS: Record<SpellId, string> = {
  runicSurge: icon('Runic_Surge_Spell.png'),
  rainbowRift: icon('Rainbow_Rift_Spell.png'),
  manaflow: icon('Manaflow_Spell.png'),
  radiancy: icon('Radiancy_Spell.png'),
  prismism: icon('Prismism_Spell.png'),
  veinboyant: icon('Veinboyant_Spell.png'),
};

/**
 * The buff icon shown in game while a spell is running. Used on the unlocked
 * spell rows, where the spell is one you actually have, and as the art on the
 * spell cards, which is what the game draws on them.
 */
export const SPELL_ACTIVE_ICONS: Record<SpellId, string> = {
  runicSurge: icon('Runic_Surge.png'),
  rainbowRift: icon('Rainbow_Rift.png'),
  manaflow: icon('Manaflow.png'),
  radiancy: icon('Radiancy.png'),
  prismism: icon('Prismism.png'),
  veinboyant: icon('Veinboyant.png'),
};

export const ESSENCE_UPGRADE_ICONS: Record<EssenceUpgradeId, string> = {
  essenceMine: icon('Essence.png'),
  flatDamage1: icon('Pickaxe_Damage.png'),
  softMaxLoot: icon('Soft_Essence_Multi.png'),
  shinyChance1: icon('Shiny_Essence_Chance.png'),
  critChance1: icon('Pickaxe_Crit_Chance.png'),
  flatDamage2: icon('Brittle_Essence_Chance.png'),
  denseMaxLoot: icon('Dense_Essence_Multi.png'),
  armorPen: icon('Obelisk_Armor_Reduction.png'),
  superCrit1: icon('Archaeology_Super_Crit_Chance.png'),
  flatDamage3: icon('Stun_Block_Chance.png'),
  damagePct: icon('Archaeology_Damage_Mult.png'),
  shinyLoot: icon('Shiny_Essence_Multi.png'),
  shinyChance2: icon('Shiny_Essence_Chance.png'),
  critChance2: icon('Archaeology_Crit_Chance.png'),
  jaggedLoot: icon('Jagged_Essence_Multi.png'),
};

export const EXCHANGE_UPGRADE_ICONS: Record<ExchangeUpgradeId, string> = {
  exchangeWizards: icon('Exchange_Wizard.png'),
  exchangeTimer: icon('Hourglass.png'),
  arcaneCardDamage: icon('Archaeology_Flat_Damage.png'),
  rainbowFloorMulti: icon('Rainbow_Floor_Multiplier.png'),
  lootbugBankedCap: icon('Banked_Lootbug_Cap.png'),
  goldenPortalChance: icon('Golden_Void_Portal_Chance.png'),
  starSupergiantMulti: icon('Star_Supergiant_Multiplier.png'),
  wizardLootMulti: icon('Wizard_Loot_Multi.png'),
  geminiStarCap: icon('Star_Specific_Cap.png'),
  veinboyantUnlock: icon('Spell_Unlock.png'),
  prismaticFloorChance: icon('Prismatic_Galactic_Floor_Chance.png'),
  shinyFishMulti: icon('Shiny_Multiplier.png'),
  runeCraftMulti: icon('Rune_Craft_Multi.png'),
};

export const MISC_ICONS = {
  mana: icon('Mana.png'),
  manaRegen: icon('Mana_Regen.png'),
  spellDuration: icon('Spell_Duration_Multi.png'),
  runeCraft: icon('Rune_Craft_Multi.png'),
  wizardLoot: icon('Exchange_Wizard_Loot_Multi.png'),
  shinyChance: icon('Shiny_Essence_Chance.png'),
  superShiny: icon('Shiny_Multiplier.png'),
  brittleChance: icon('Brittle_Essence_Chance.png'),
} as const;

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** The frame a card is drawn in. Locked cards have none. */
export const CARD_BACKINGS: Record<Exclude<CardTier, 'none'>, string> = {
  normal: icon('Card_Backing_Standard.png'),
  gilded: icon('Card_Backing_Gilded.png'),
  polychrome: icon('Card_Backing_Polychrome.png'),
};

/** What each Orb Trade card depicts. */
export const ORB_CARD_ICONS: Record<OrbCardId, string> = {
  white: icon('White_Orb.png'),
  green: icon('Green_Orb.png'),
  purple: icon('Purple_Orb.png'),
  orange: icon('Orange_Orb.png'),
  red: icon('Red_Orb.png'),
  yellow: icon('Yellow_Orb.png'),
};

/** Essence cards depict the max-loot icon for their essence type. */
export const ESSENCE_CARD_ICONS: Record<EssenceType, string> = {
  soft: icon('Soft_Essence_Multi.png'),
  dense: icon('Dense_Essence_Multi.png'),
  jagged: icon('Jagged_Essence_Multi.png'),
};

// ---------------------------------------------------------------------------
// Pets and unlocks
// ---------------------------------------------------------------------------

export const PET_ICONS = {
  rhino: icon('Rhino_Default.png'),
  rhinoSkin: icon('Rhino_Skin.png'),
  rhinoQuest: icon('Rhino_Quest.png'),
} as const;

export const UNLOCK_ICONS = {
  worldQuest25: icon('Shiny_Essence_Chance.png'),
  worldQuest29: icon('Shiny_Multiplier.png'),
  straightOuttaYanille: icon('Straight_Outta_Yanille.png'),
  arcanistBundle: icon('Arcanist_VP.png'),
  statueOfNature: icon('22_Statue_Nature_Gilded.png'),
} as const;
