# Differences from the spreadsheet

This app is a port of the **Arcanist** sheet from the community workbook
*Obelisk Total Resources Calculator v7.1.1*. It is a faithful port with four
deliberate exceptions, listed here so a number that disagrees with the workbook
is explainable rather than mysterious.

The golden test (`src/calc/engine.test.ts`) asserts the app against the
workbook's own cached values for every other computed cell, and asserts these
four *do* differ — so a correction can never be confused with a transcription
slip.

## Corrected

### 1. Jagged hits-to-mine ignored the block's regeneration (`AJ3`)

The Soft and Dense columns subtract their avg-regen cell (`AC18`, `AF18`). The
Jagged column subtracts `AI1` — an empty cell — instead of `AI18`.

With the workbook's own inputs this reads **82** hits where the correct figure
is **84**, and the error cascades into Jagged blocks/hr, essence/hr and net
essence/hr. The app reports Jagged income of 73.63/hr against the sheet's 75.27.

### 2. Runic Surge nested its pet bonus differently from every other spell (`E45`)

Five spells compute `… * (1 + rank * 0.05) * (1 + petPotency)`. Runic Surge's
primary effect computes `… * (1 + rank * 0.05 * (1 + petPotency))`, folding the
pet bonus into the rank term.

The two forms coincide when the pet bonus is zero, which it is in the source
workbook — so the sheet's displayed value is unaffected, but any player with
that pet bonus would get the wrong number. Normalised to the majority form.

### 3. Locked spells still granted their second effect (`E46`, `E50`, `E54`, `E58`, `E62`, `E66`)

Each spell's *primary* effect is wrapped in `IF(unlocked, …)`. The *secondary*
effects are not.

Most visibly: Veinboyant is locked in the source workbook (`A64 = 0`), yet
`E66` still grants 0.15 Rune Craft Multi, which flows through `Statmath!C372`
into every altar's rune output. All spell effects are now gated on the unlock
flag.

### 4. The "Super Crit Damage" upgrade did nothing (`E15`, `N8`)

`E15` computes `level * 0.01`, but the Super Crit Damage stat (`N8`) is
hardcoded to `2` and never reads it — unlike Crit Damage, where `N6` reads
`E9`. Confirmed in game as a bug; the stat is now `2 * (1 + E15)`, mirroring
`N6`.

This also moves the super crit and ultra crit rows of the damage table
(`AA18`, `AA19`, both derived from `N8`) and therefore the weighted average
damage multiplier `Z23`. The shift is small — the super crit branch carries
about 0.13% of the weight — so with the workbook's inputs it does not move any
hits-to-mine figure, which is rounded up to a whole hit.

### 5. "Flat Damage +2%" priced its curve from the wrong base (`G18`)

The sheet starts this row's white-orb curve at 2 and grows it by 1.2 per level,
the same base it gives the Crit Chance / Crit Damage row. In game it starts at
3. The base is the only thing that changed, and the curve is geometric, so
every figure on the row — next level, remaining, and its share of the white orb
total (`C89`) — is exactly 1.5x what the workbook cached.

Pinned in `engine.test.ts` against the sheet value rather than a literal, so
the assertion states the relationship rather than restating a number nobody can
check.

## Not changed — unreleased content

### Ultra crit is inert

`N9` (Ultra Crit Chance) is hardcoded `0` and no upgrade feeds it, so the ultra
crit branch of the damage table never contributes.

That is correct today: ultra crit is not in the Arcanist yet, though it is
planned. The branch is carried as a constant `0` so it costs nothing now and
only needs a chance source wired in when the upgrade ships — the damage ladder
in `engine.ts` already handles it.

## Added — modelled here, absent from the sheet

### Exclusive mining and altar stalling

The workbook computes all three essences' net-per-hour side by side, as though
you earned them simultaneously, and lets an altar drive a pool negative.

Neither matches the game. The Arcanist mines one essence at a time, and an altar
stalls on an empty pool rather than overdrawing it. Both are modelled here:

- `ArcanistInput.mining` says which essence you are on. The other two still
  report their income — that is what makes them answerable as "if you switched"
  — but they bank nothing.
- Each altar carries `supplyFactor` (`min(1, pool income ÷ pool drain)`) and
  `sustainedRunesPerHour` beside its nominal rate. The optimizer reads the
  sustained one.
- `sustainedNet` is income less what the altars can actually take, floored at
  zero.

`netEssencePerHour` is **unchanged** and still asserted against `P16`/`X28`/`X29`,
so the golden test stays a transcription check. It can read negative where the
game cannot; `sustainedNet` is the user-facing figure.

Consequence worth stating plainly: rune income reads lower than it used to
wherever a pool is starved, because the old figures assumed essence was free and
infinite.

## Current wiki overrides

### Exchange upgrade costs and released rows

The first version of this app intentionally removed Exchange prices because the
workbook values could not be verified. The supplied **12 Sep 2026 Arcanist wiki
snapshot now publishes detailed cost tables**, so all thirteen released Exchange
upgrades are restored and those current tables are the source of truth.

This matters because several workbook curves are stale. For example, the current
page prices **Star Supergiant Multi** from 25T Lynx rather than the workbook's
older 250T curve, and **Wizard Loot Multi** uses a 1.25 growth factor rather than
the older 1.30 curve. Exchange costs now flow into Total Resources and optimizer
step prices like every other documented purchase.

Only two Exchange levels change Arcanist outputs directly:

- **Essence Damage Per Arcane Card** — flat damage equal to the Arcane card count.
- **Rune Craft Multiplier** — +1% per level into altar craft output.

The other eleven are still shown because they are real released purchases with
real costs; they simply score zero on this calculator's Arcanist objectives when
their effects belong to another game system.

One source conflict is left deliberately conservative: the Exchange summary says
**Gemini Star Cap** has 20 levels, while its detailed cost table stops at level 10
and gives the row total there. The calculator models 10 priced levels rather than
inventing costs for 11–20.

### Batch 2 rows with incomplete numerical data

The same current page lists more content than it provides enough data to model:

- **Drift Rune** and **Echo Rune** altars have unlock requirements but no cycle
  data or altar-upgrade cost tables in the supplied page.
- **Bug Magnet** has its effects, duration and cast cost, but no potency-cost
  table.
- The other new spell rows still contain `???` values.
- Additional Essence / Exchange rows explicitly marked **WIP** are not treated as
  released purchases.

Those items are surfaced as notes in the UI but are not assigned guessed values.

Share links from v4 no longer decode. The packed format is positional, so its
marker moved from `s` to `t`; old tokens are rejected rather than silently
reinterpreted. JSON exports still load: fields missing from an older export
default to zero.

### The completion tracker

The workbook's `K87:L99` block counts levels owned against levels available,
per section and overall, up to a grand total of 1048 (`L99`, which includes a
flat 180 reserved for unreleased content).

That is a completionist's scoreboard, and this is a planner. Nothing else on the
page reads it, no decision turns on it, and it counts levels rather than value —
a three-level row weighs the same as a twenty-five-level one. It belonged to the
sheet and does not belong here. Removed along with `COMPLETION_RESERVED`, so no
part of the app now depends on the reserved-levels fudge.

Everything the tracker summarised is still visible where it is actionable: each
row shows its own level against its maximum, and Total Resources shows what is
left to buy.

## Renamed

### The two obelisk shiny unlocks

The workbook labels `Obelisks!H28` as **Obelisk 26**, requirement *"Reach Rhino
Pet Level 3"*, and `H32` as **Obelisk 30**, requirement *"Reach Rhino Pet Level
10"*.

The app calls them **World Quest 25 completed** and **World Quest 29
completed**, on the authority of a player. The effects are identical either way
(+1% Essence Shiny Chance and +2% Essence Super Shiny Chance), so only the
source name differs — the workbook appears to have attributed them to the wrong
system.

## Confirmed correct — do not "fix"

### Altar essence routing

The Ash and Brine altars both drain **Soft** essence; the Chasm altar drains
**Dense** (`X28 = V28 + V29`, `X29 = V30`). Nothing drains Jagged, which is why
`X30` is empty. This is asymmetric and looks like an oversight, but it matches
the game — confirmed 2026-07-31. `src/calc/constants.ts` encodes it as each
altar's `consumes` field.

## Cosmetic

The sheet's number formatter leaves a trailing `.` when its `"0.##"` branch
rounds to a whole number (`50. Sextillion`). The app drops it. This affects
display only.
