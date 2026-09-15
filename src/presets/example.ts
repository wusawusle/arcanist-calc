/**
 * The state of the Arcanist sheet in the source workbook.
 *
 * This doubles as the golden-test input: engine.test.ts asserts that computing
 * from these values reproduces the workbook's cached cell values. Do not edit
 * without regenerating the fixture from the same workbook.
 */

import type { ArcanistInput } from '../calc/types';

export const EXAMPLE_INPUT: ArcanistInput = {
  essence: {
    essenceMine: 2, // A4
    flatDamage1: 17, // A5
    softMaxLoot: 2, // A6
    shinyChance1: 7, // A7
    critChance1: 9, // A8
    flatDamage2: 12, // A10
    denseMaxLoot: 1, // A12
    armorPen: 5, // A13
    superCrit1: 2, // A14
    flatDamage3: 4, // A16
    damagePct: 10, // A18
    shinyLoot: 1, // A19
    shinyChance2: 1, // A20
    critChance2: 7, // A22
    jaggedLoot: 1, // A24
    regenRespawn: 0,
    superShinyChance1: 0,
    weakenNegate: 0,
    allMaxLoot: 0,
    damagePctBrittle: 0,
    superShinyLoot: 0,
    ultraCrit1: 0,
    critDamageAttackSpeed: 0,
    allMinLoot: 0,
    allDebuffNegate: 0,
    critRespawn: 0,
    superCritDaze: 0,
    ultraShiny: 0,
    allShinyLoot: 0,
    damagePctArmorPen: 0,
    superCritStun: 0,
    flatSuperCrit: 0,
    critDamageUltraCrit: 0,
    superShinyAttackSpeed: 0,
  },
  altars: {
    ash: { unlocked: true, active: false, capacity: 8, travel: 10, craft: 4 }, // K27, A29:A31
    brine: { unlocked: true, active: true, capacity: 5, travel: 10, craft: 3 }, // A33, K32, A34:A36
    chasm: { unlocked: true, active: false, capacity: 5, travel: 10, craft: 0 }, // A38, K37, A39:A41
  },
  spells: {
    runicSurge: { unlocked: true, level: 13, rank: 10 }, // A43, A45, A46
    rainbowRift: { unlocked: true, level: 1, rank: 2 }, // A48, A49, A50
    manaflow: { unlocked: true, level: 1, rank: 0 }, // A52, A53, A54
    radiancy: { unlocked: true, level: 3, rank: 0 }, // A56, A57, A58
    prismism: { unlocked: true, level: 1, rank: 4 }, // A60, A61, A62
    veinboyant: { unlocked: false, level: 0, rank: 0 }, // A64
  },
  exchange: {
    exchangeWizards: 0, // A69
    exchangeTimer: 0, // A70
    arcaneCardDamage: 1, // A71
    rainbowFloorMulti: 0, // A72
    lootbugBankedCap: 0, // A73
    goldenPortalChance: 0, // A74
    starSupergiantMulti: 0, // A75
    wizardLootMulti: 0, // A76
    geminiStarCap: 0, // A77
    veinboyantUnlock: 0, // A78
    prismaticFloorChance: 0, // A79
    shinyFishMulti: 0, // A80
    runeCraftMulti: 0,
    arcanistSpellPower: 0, // A81
  },
  external: {
    cards: {
      essence: {
        soft: 'polychrome', // Cards!K422 = 4
        dense: 'normal', // Cards!K423 = 1
        jagged: 'normal', // Cards!K424 = 1
      },
      rune: {
        ash: 'polychrome', // Cards!K429 = 0.5
        brine: 'gilded', // Cards!K430 = 0.3
        chasm: 'none', // Cards!K431 = 0
      },
      spell: {
        runicSurge: 'gilded', // Cards!K438 = 0.2
        rainbowRift: 'gilded', // Cards!K439 = 0.2
        manaflow: 'normal', // Cards!K440 = 0.1
        radiancy: 'none', // Cards!K441 = 0
        prismism: 'none', // Cards!K442 = 0
        veinboyant: 'none', // Cards!K443 = 0
      },
      orb: {
        white: 'gilded', // Cards!K446 = 0.3
        green: 'gilded', // Cards!K447 = 0.3
        purple: 'normal', // Cards!K448 = 0.15
        orange: 'none', // Cards!K449 = 0
        red: 'none', // Cards!K450 = 0
        yellow: 'none', // Cards!K451 = 0
      },
    },
    pets: {
      rhinoLevel: 5, // Pets!A37 (E38 = 0.05 brittle)
      rhinoSkin: false, // Pets!A57 = 0
      rhinoQuestSkin: false, // Pets!A75 = 0
      rhinoQuestLevel: 0, // Pets!A108
      rhinoCard: 'none', // Cards!K282 = 0
    },
    unlocks: {
      worldQuest25: false, // Obelisks!E28 = 0
      worldQuest29: false, // Obelisks!E32 = 0
      straightOuttaYanille: false, // Skills!A157 = 0
      arcanistBundle: false, // Store!G111 = 0
      statueOfNatureGilded: false, // Construct!I350 = 0
      w4GildedStatues: 0, // Construct!E554 = 0
    },
    contractRuneCraftLevel: 16, // Contracts!A45 (D45 = 0.08)
  },
  // The sheet has no notion of mining one essence at a time, so this is not
  // from the workbook; Soft is what its running altars drain.
  mining: 'soft',
};
