# IOM Arcanist Optimizer

A planner for the **Arcanist** (Ob70) content in *Idle Obelisk Miner*: essence
upgrades, the currently calculable rune altars and spells, all thirteen released
Exchange upgrades, and the mining math that turns all of it into essence per hour.

**→ https://OrionAF.github.io/iom-arcanist-optimizer/**

It shows Soft, Dense and Jagged essence side by side — income, altar drain and
net per hour — and recalculates as you change any level. You mine one essence at
a time, so click the one you are on: the other two keep reporting what they
*would* pay, and the altars they feed report what they can actually sustain.

## Credit

Based on the **Arcanist** sheet from
[Obelisk Total Resources Calculator](https://docs.google.com/spreadsheets/d/1hj4YvYYNlAmXD9LHZNsDQS2n1pFI8H34_1-RS_RlU-E/edit?usp=sharing)
by **Stonestriker**, heavily modified. All credit for working out the underlying
formulas belongs there; this project ports them to a shareable web page and
extends them.

Icons are game assets from the [wiki](https://shminer.wiki.gg/), vendored into
`public/icons/` — see [ICON-CREDITS.md](ICON-CREDITS.md).

## Using it

Everything you can change lives in the left column; the right column is
read-only output.

- **Levels** — every row takes your current level, and prices it two ways: what
  the next level costs, and what the rest of the row costs to max. All thirteen
  released Exchange rows are included using the supplied 12 Sep 2026 wiki cost
  tables — see [CORRECTIONS.md](CORRECTIONS.md).
- **Cards, Pets, Unlocks, Contracts** — what the rest of your account
  contributes. Defaults are all zero, so fill these in or the numbers read low.
  Cards are picked by tier; the tier total drives Essence Damage Per Arcane Card.
- **?** — every derived number has one. It explains what the figure is and, where
  the shape of the calculation is the answer, how it is worked out.
- **Show the math** — the full derivation: crit/shiny/brittle probability
  tables, per-block stats, hits to mine, and where the essence goes.
- **Sections fold.** Which ones you leave closed is remembered locally, and is
  not part of the build a share link carries.
- Builds autosave locally. **Export** writes a JSON file; **Share link** puts
  the whole build in the URL.

### 12 Sep 2026 data status

The supplied current wiki snapshot documents the complete cost tables for all
thirteen released Exchange upgrades, so those are now modelled and included in
Total Resources. It also names Batch 2 content whose numerical data is not yet
complete enough to calculate safely:

- **Drift / Echo altars:** unlock requirements are listed, but cycle stats and
  their three altar-upgrade cost tables are absent.
- **Bug Magnet:** effect, duration and cast cost are listed, but no potency-cost
  table is present.
- **Other new spells:** several effect/unlock cells are still shown as `???`.
- Rows explicitly marked **WIP** on the page remain excluded.

The UI calls these gaps out rather than inventing values.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # golden test against the workbook's cached values
npm run build    # production build
```

If you have the source workbook, put it in the project root and run `npm run
fixture` to regenerate the golden fixture. `tools/extract_arcanist.py` reads the
`.xlsx` with the Python standard library (no openpyxl) and writes every Arcanist
cell's cached value to `src/calc/__fixtures__/arcanist-sheet.json`.

To take screenshots, `node tools/shoot.mjs <url> <out.png> [waitMs] [width]
[height]` drives headless Edge over the DevTools Protocol with a real wait,
which `--screenshot --virtual-time-budget` cannot do.

## Design notes

### How it fits together

The calculator is a pure function — `compute(input)` in `src/calc/engine.ts` —
with no DOM or React anywhere near it. It returns every intermediate value, not
just the headline numbers, which is what lets the "show the math" panel, the
golden test and the optimizer all read from one source.

Costs are closed-form (`src/calc/costs.ts`) rather than the sheet's
`SUMPRODUCT` loops, so the engine stays cheap enough to call in a search loop.

Game data lives in `src/calc/constants.ts`. A balance patch should be fixable by
editing that one file.

### The optimizer

`src/calc/optimize.ts` answers "what should I buy next". It scores an upgrade by
buying one level of it and running `compute` again — no formula is duplicated
from the engine, so a balance patch moves the rankings on its own. A full
ranking of every available upgrade is one `compute` per candidate and runs in a
few milliseconds, which is what lets it refresh on every keystroke.

It does not search for a best *build*: every upgrade is monotone-positive and
eventually affordable, so the best build is trivially "max everything". The
order is the real question.

Two rankings are shown, because there are two goals — essence per hour and runes
per hour — and altar throughput trades one for the other. Within each, upgrades
are grouped by the resource they cost, since a white-orb price and a rune price
cannot be compared without an exchange rate nobody has.

The altars are the only place the two goals genuinely conflict. Capacity and
travel speed scale rune output and essence drain by the same factor and cancel,
so a single altar converts essence to runes at exactly its craft multiplier no
matter how it is tuned. That cancellation is per altar, not across a set — the
tests pin both halves of it.

### Essence supply

The workbook models all three essences as earning at once and lets an altar
drain a pool past empty. Neither is true: you mine one essence at a time, and an
altar stalls on an empty pool rather than going negative.

So every altar carries two rates. `runesPerHour` is the nominal one — what it
would produce if fed. `sustainedRunesPerHour` multiplies that by
`min(1, pool income ÷ pool drain)`, which is 1 whenever your pickaxe outpaces
the altars and collapses toward zero when it does not. The optimizer reads the
sustained figure, because the nominal one describes an altar nobody can feed.

`netEssencePerHour` keeps the workbook's formula and stays asserted against the
sheet, so the golden test remains a transcription check. `sustainedNet` is what
the UI shows; it is never negative.

One consequence worth knowing: on a starved pool, capacity buys nothing. An
altar converts at `(1 + craft × 0.2) × (1 + card) × runeCraftMulti`, which has
no capacity term, so a starved altar's output is set by what you mine.

### Horizons

Every number in this app answers a question about the *next* purchase, not about
a finished build. A panel that projected spell potencies out to rank 10 was
built and deleted: it produced a three-week schedule that no purchase survived,
restated what the optimizer already said in one line, and spent most of its
length on ranks worth exactly zero.

Rune costs carry a time-to-afford at the current sustained rate. One purchase is
as far as that stays true, because buying anything moves the rates.
