/**
 * The glossary behind every "?" in the UI.
 *
 * Data, not prose in components: an explanation lives next to the other
 * explanations so the whole vocabulary can be read and kept consistent in one
 * place, and a label that gains a "?" only needs an entry added here.
 *
 * `formula` is optional and only present where the shape of the calculation is
 * the answer. It is written the way the engine computes it, not the way the
 * source workbook spelled it, so it stays checkable against `engine.ts`.
 */

export interface HelpEntry {
  /** Heading of the popover. Usually the label it sits beside. */
  title: string;
  /** Paragraphs, split on blank lines when rendered. */
  body: string;
  /** How it is worked out, when that is the useful part. */
  formula?: string;
}

export const HELP = {
  // ------------------------------------------------------------- cost columns

  nextRemaining: {
    title: 'Next / Remaining',
    body: 'The left number buys exactly one more level — the decision in front of you right now. The right number is what\'s left to max it.',
  },
  potencyCost: {
    title: 'Potency next / remaining',
    body: 'Runes to raise this spell\'s potency by one rank, then runes to carry it to rank 10. Each spell requires one rune type only, and the cost multiplies by 1.25 every rank.\n\nSpell level and potency are priced separately; only potency is priced here.',
  },

  // ------------------------------------------------------------------ ledger

  ledgerNet: {
    title: 'Net essence / hour',
    body: 'What actually lands in your satchel: everything you mine of this essence, minus everything the altars on it burn.\n\nYou can only mine one essence at a time, so this is a live figure for the one you are mining and a "what if" for the other two — click a card to switch. An essence you are not mining banks nothing, whatever its income says.\n\nIt cannot go below zero. If the altars want more than you can mine they stall rather than overdraw the pool: you bank nothing and they run at part rate.',
    formula: 'net = income − altar drain, and never below 0',
  },
  ledgerIncome: {
    title: 'Income',
    body: 'Essence per hour from mining this essence block, before any altar spends it. It is the mined block rate multiplied by the average loot an essence block drops, including the bonus loot that shiny procs add.',
    formula: 'income = blocks mined/hr × average loot per essence block',
  },
  ledgerDrain: {
    title: 'Altar drain',
    body: 'Essence per hour consumed by every altar that is unlocked and running on this essence. Ash and Brine altars both draw on Soft essence, Chasm draws on Dense, and nothing draws on Jagged.\n\nAn altar that is unlocked but not running drains nothing and produces nothing.',
  },
  ledgerLootRange: {
    title: 'Loot per block',
    body: 'What one block pays. The bottom is a minimum roll with no shiny; the top is a maximum roll that also procs super shiny, since shiny is added on top of the roll rather than being part of it.\n\nThe average beside it is what the hourly figures are built from, and it sits wherever the odds put it rather than in the middle of the range — the Max Loot upgrades raise the top of the roll without moving the bottom.',
    formula: 'income/hr = blocks mined/hr × average loot',
  },
  ledgerBlocks: {
    title: 'Essence blocks / hour',
    body: 'How many of this essence block you mine in an hour. One mined block takes the time it takes for you to mine through the block\'s health plus its respawn delay, so past a certain point extra damage stops helping much — respawn becomes the floor.',
    formula: 'mined blocks/hr = 3600 ÷ (time to mine + respawn)',
  },

  // ------------------------------------------------------------------ altars

  altarCycle: {
    title: 'Cycle',
    body: 'How long one trip of the altar takes. Travel Speed shortens it by 5% of the base per level. Shorter cycles mean more runes per hour and more essence used per hour, in the same proportion.',
    formula: 'cycle = base × (1 − 0.05 × travel) × 2',
  },
  altarRunesPerCycle: {
    title: 'Runes per cycle',
    body: 'Runes produced by one trip. Capacity sets how much essence the altar carries per trip, and Rune Craft plus the global Rune Craft Multi set how many runes each unit of essence becomes.',
  },
  altarRunesPerHour: {
    title: 'Runes per hour',
    body: 'What this altar actually sustains, which is capped by the essence reaching it rather than by how well it is tuned. An altar stalls on an empty pool, so if it wants more essence per hour than you mine, it runs at a fraction of its nominal rate — shown beneath as "starved".\n\nAn altar on an essence you are not mining sustains nothing at all: it eats through whatever is banked and then stops.',
    formula: 'sustained = nominal × min(1, pool income ÷ pool drain)',
  },
  altarEssencePerHour: {
    title: 'Essence per hour (altar)',
    body: 'What this altar costs you per hour while it runs, taken out of the essence it draws on. This is the drain side of the Net figure at the top of the page.\n\nCapacity and cycle time appear in both this number and the rune output and cancel out, so tuning one altar does not change its exchange rate — it only changes how fast it trades.',
  },
  runeCraftMulti: {
    title: 'Rune craft multiplier',
    body: 'A single multiplier applied to every altar\'s rune output, gathered from outside the altar itself: the Arcanist store bundle, the Rune Craft contract, the Exchange upgrade, and Prismism\'s potency.\n\nBecause it multiplies all three altars at once, it is usually the highest-leverage thing on the page for runes.',
  },

  // --------------------------------------------------------------- stats box

  statDamage: {
    title: 'Damage',
    body: 'Your nominal hit before essence block armour. Essence block armour is subtracted from it and crits multiply it, so what actually lands is the Damage per hit figure under Show the math.',
  },
  statAttackInterval: {
    title: 'Attack every',
    body: 'Seconds between your attacks. Combined with damage per hit, this sets how fast you mine an essence block.',
  },
  statCritChance: {
    title: 'Crit chance',
    body: 'Chance for a hit to crit. Crits, super crits and ultra crits are checked in sequence, and the expected damage multiplier that falls out of that ladder is the Crit tier table under Show the math.',
  },
  statCritDamage: {
    title: 'Crit damage',
    body: 'Multiplier applied when a hit crits. A crit that also super crits multiplies again, which is why the expected multiplier is worth more than this number alone suggests.\n\nThe figure beside it is what a crit lands for: your nominal Damage times this multiplier, before essence block armour comes off.',
  },
  statSuperCrit: {
    title: 'Super crit',
    body: 'Chance for a hit that already crit to crit a second time. It is conditional, not independent — a hit that never crit cannot super crit.',
  },
  statSuperCritDamage: {
    title: 'Super crit damage',
    body: 'Multiplier stacked on top of the crit multiplier when a hit super crits.\n\nThe figure beside it carries both multipliers, because a hit only reaches super crit by having crit first. It is what that hit lands for before essence block armour comes off.',
  },
  statArmorPen: {
    title: 'Armour penetration',
    body: 'Flat armour ignored on every hit. Essence block armour is subtracted from your damage before anything else, so against a heavily armoured essence a point of penetration can be worth far more than a point of damage.',
  },
  statStunNegate: {
    title: 'Stun negate',
    body: 'Chance to shrug off the essence block\'s stun. A stun costs you attack time, so negating it raises your effective mine rate without touching damage at all.',
  },
  statShinyChance: {
    title: 'Shiny chance',
    body: 'Chance for a mined essence block to drop bonus loot. Super shiny is rolled on top of it, so the expected bonus per mined essence block is the Shiny proc table under Show the math rather than this number times the bonus.',
  },
  statShinyBonus: {
    title: 'Shiny bonus',
    body: 'Extra essence a shiny essence block drops, on top of its normal roll.',
  },
  statSuperShiny: {
    title: 'Super shiny',
    body: 'Chance for a mined essence block that already went shiny to go shiny again, dropping the bonus a second time. Fed mostly by world quests, gilded statues and the Rhino card.',
  },
  statBrittleChance: {
    title: 'Brittle chance',
    body: 'Chance for a mined essence block to leave the next essence block brittle, so it needs less than its nominal health. It shows up as the expected health fraction under Show the math and as brittle essence blocks per hour.',
  },

  // -------------------------------------------------------- show the math --

  mathShinyTable: {
    title: 'Shiny proc table',
    body: 'Every way one block\'s loot roll can turn out, with the chance of each and the bonus loot it adds. The rows are exclusive and their chances sum to one.\n\nThe last line is the average across all of them — that is the number the income calculation actually uses, not the headline shiny chance.',
  },
  mathCritTable: {
    title: 'Crit tier table',
    body: 'The crit ladder resolved into exclusive outcomes: no crit, crit, crit and super crit, and so on, each with its damage multiplier.\n\nThe average at the bottom is your real expected damage multiplier, which is what damage per hit is built on.',
  },
  mathBrittleTable: {
    title: 'Brittle table',
    body: 'How much of a block\'s nominal health you actually have to work through, weighted by how often it is brittle. A value below 1 means the average block breaks to less damage than its health bar claims.',
  },
  mathHealth: {
    title: 'Health',
    body: 'The essence block\'s health. A game constant — no upgrade on this page changes it.',
  },
  mathArmor: {
    title: 'Armour (after pen)',
    body: 'What is left of the block\'s armour once your penetration is subtracted, shown against the full value. Armour comes off every hit before crits are applied, so if it meets or beats your damage you cannot mine this essence at all, no matter how fast you attack.',
  },
  mathStun: {
    title: 'Average stun factor',
    body: 'The share of your attack time that survives the block\'s stuns, after your stun negation. 1 means you are never stunned; lower means some of your attacks never happen.',
  },
  mathWeaken: {
    title: 'Average weaken factor',
    body: 'The average multiplier the block\'s weaken debuff applies to your damage, weighted by how often it lands and how long it lasts. Below 1 means you are weakened some of the time.',
  },
  mathRegen: {
    title: 'Regen per hit',
    body: 'Health the block regenerates, expressed per attack of yours so it can be set directly against your damage. If it matches your damage after armour, the block repairs itself as fast as you break it and never yields.',
  },
  mathDamagePerHit: {
    title: 'Damage per hit',
    body: 'What one hit really takes off a block: your damage less its armour, scaled by the expected crit multiplier and the weaken factor, less the health it regenerates back.',
    formula: 'per hit = (damage − armour) × crit multi × weaken − regen',
  },
  mathHitsToMine: {
    title: 'Hits to mine',
    body: 'Attacks needed to break one block, using the brittle-adjusted health rather than the nominal figure. A dash means the block regenerates faster than you break it and the count is infinite.',
    formula: 'hits = health × brittle multi ÷ damage per hit',
  },
  mathTimeToMine: {
    title: 'Time to mine',
    body: 'Hits to mine spread over your attack interval, stretched by the time stuns take away from you.',
    formula: 'time = hits × attack interval ÷ stun factor',
  },
  mathRespawn: {
    title: 'Respawn',
    body: 'Idle time between one block breaking and the next appearing. A game constant, and the hard ceiling on blocks per hour — once time to mine is small next to respawn, more damage buys you almost nothing.',
  },
  mathLootRange: {
    title: 'Loot range',
    body: 'The minimum and maximum essence a single ordinary block can drop, after the Max Loot upgrades, cards and pet skin have been applied.',
  },
  mathLuckiestLoot: {
    title: 'Loot range (with shiny)',
    body: 'The same range with a shiny proc on top of it. Shiny is added to the roll rather than being part of it, so the luckiest possible block — a maximum roll that also procs super shiny — pays above the top of the ordinary range.\n\nBonuses you have no chance of rolling are left out, so with no super shiny source the top of this range is a plain shiny.',
    formula: 'luckiest = max roll + shiny bonus + super shiny bonus',
  },
  mathAvgLoot: {
    title: 'Average loot (with shiny)',
    body: 'The mean of the loot range plus the expected shiny bonus from the table above. This is the per-block figure income is built from.',
  },
  mathBlocksPerHour: {
    title: 'Blocks / hour',
    body: 'One hour divided by a full mining cycle — the time to break a block plus the time to wait for the next one to appear.',
    formula: 'blocks/hr = 3600 ÷ (time to mine + respawn)',
  },
  mathBrittleBlocks: {
    title: 'Brittle blocks / hour',
    body: 'How many of those blocks were left brittle by the one before. Shown separately because it is the part of your mining rate that brittle chance is buying.',
  },
  mathEssencePerHour: {
    title: 'Essence / hour',
    body: 'Gross essence income for this essence, before any altar spends it.',
    formula: 'essence/hr = blocks/hr × average loot',
  },
  mathAltarDrain: {
    title: 'Altar drain / hour',
    body: 'Essence per hour taken out of this essence by running altars. Ash and Brine draw on Soft, Chasm draws on Dense, Jagged is never drained.',
  },
  mathNet: {
    title: 'Net / hour',
    body: 'Income less drain — the same figure as the headline at the top of the page, shown here at the end of the derivation that produced it.',
  },

  // --------------------------------------------------------------- panels --

  optimizer: {
    title: 'Optimizer',
    body: 'What each upgrade is worth, measured by buying it, recomputing the whole model, and diffing the result. Nothing here is estimated.\n\nThe arrows show how many levels the recommendation is for, and the price is for exactly that. It is usually one level, but not always: hits to mine a block is a whole number, so a single point of damage often buys nothing at all until it removes a hit. Where that happens the row is priced at the smallest buy that does something, and compared against the alternatives on that footing.\n\nThere are two lists because there are two goals and they do not always agree — altar throughput buys runes with essence, so an upgrade can be near the top of one list and negative on the other. Within a list, upgrades are grouped by the resource they cost, since a pile of white orbs cannot buy a rune upgrade.\n\nBoth goals count only what you can sustain. Essence counts the essence you are mining, not all three at once; runes count what your altars can actually be fed. An upgrade that raises an altar past what the pool supports shows no gain, because it would give you none.',
  },
  exchange: {
    title: 'Exchange',
    body: 'All thirteen released Exchange upgrades are listed and priced from the supplied 12 Sep 2026 Arcanist wiki snapshot. Most affect systems outside this calculator, so their level changes no Arcanist output here; Essence Damage Per Arcane Card and Rune Craft Multiplier are the two that feed this page\'s calculations.\n\nGemini Star Cap is capped at level 10 here because its detailed wiki cost table ends at 10 even though the summary row says 20. Levels 11–20 are not guessed.',
  },
  totalsPanel: {
    title: 'Total resources',
    body: 'Everything still owed to max every priced upgrade on the page, and what those upgrades cost end to end.\n\nOnly resources a modelled released row can actually cost appear. Exchange costs are included from the supplied 12 Sep 2026 Arcanist wiki snapshot, so their stars, essence, prestige points, veins and Blue Cow costs are part of these totals.',
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof HELP;
