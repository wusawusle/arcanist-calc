import {
  ALTARS,
  ALTAR_IDS,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  RESOURCE_LABELS,
  SPELLS,
  SPELL_IDS,
} from '../../calc/constants';
import { formatDuration, formatNumber, formatPercent } from '../../calc/format';
import type { AltarId, ArcanistInput, ArcanistResult, UpgradeCost } from '../../calc/types';
import {
  BundleAmount,
  CostPair,
  Help,
  Icon,
  LevelInput,
  Section,
  Stat,
  Subhead,
  Switch,
} from '../components';
import {
  ALTAR_ICONS,
  ESSENCE_UPGRADE_ICONS,
  EXCHANGE_UPGRADE_ICONS,
  MISC_ICONS,
  SECTION_ICONS,
  SPELL_ACTIVE_ICONS,
  SPELL_ICONS,
} from '../icons';

interface Props {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

/*
 * Every `.rows` table carries explicit ARIA roles.
 *
 * Below 720px these tables stop being tables: each row becomes a small grid, so
 * the actionable cost sits beside the name instead of off the right edge behind
 * a sideways scroll. Changing `display` away from `table` also drops the roles
 * the browser was inferring from the tags, so they are spelled out here to put
 * them back. On a wide screen they are exactly what the tags already meant.
 */
function RowsHead() {
  return (
    <thead role="rowgroup">
      <tr role="row">
        <th role="columnheader" scope="col">
          Upgrade
        </th>
        <th role="columnheader" scope="col">
          Level
        </th>
        {/* Classed so that hiding the effect column on a narrow screen hides the
            header with it — otherwise every following header shifts one column
            left and the last one runs off the edge. */}
        <th role="columnheader" scope="col" className="effect">
          Effect
        </th>
        <th role="columnheader" scope="col" style={{ textAlign: 'right' }}>
          Next / Remaining <Help id="nextRemaining" />
        </th>
      </tr>
    </thead>
  );
}

function CostRow({
  row,
  max,
  icon,
  onChange,
}: {
  row: UpgradeCost;
  max: number;
  icon?: string;
  onChange: (next: number) => void;
}) {
  return (
    <tr role="row" className={row.level >= max ? 'maxed' : undefined}>
      <td role="cell" className="name" title={row.note}>
        <span className="named">
          {icon ? <Icon src={icon} size={20} dim={row.level >= max} /> : null}
          <span>
            {row.label}
            {row.note ? <span style={{ color: 'var(--text-faint)' }}> ⁎</span> : null}
          </span>
        </span>
      </td>
      {/* `data-label` is what the narrow layout prints in front of the stepper,
          standing in for the column header it no longer sits under. */}
      <td role="cell" className="ctl" data-label="Level">
        <LevelInput value={row.level} max={max} onChange={onChange} label={row.label} />
      </td>
      <td role="cell" className="effect">
        {row.effectText}
      </td>
      {/* Cost to max is not shown per row: it never changes as you play, and
          the Total Resources panel already sums it. Next and remaining are the
          two numbers that move. */}
      {row.priced ? (
        <td role="cell" className="cost">
          <CostPair next={row.next} remaining={row.remaining} />
        </td>
      ) : null}
    </tr>
  );
}

// ---------------------------------------------------------------- essence --

export function EssenceUpgrades({ result, update }: Props) {
  return (
    <Section title="Essence Upgrades" icon={SECTION_ICONS.essence} eyebrow="orbs · runes" flush>
      <div className="scroll-x">
        <table className="rows" role="table">
          <RowsHead />
          <tbody role="rowgroup">
            {result.rows.essence.map((row, i) => {
              const def = ESSENCE_UPGRADES[i]!;
              return (
                <CostRow
                  key={row.id}
                  row={row}
                  max={def.max}
                  icon={ESSENCE_UPGRADE_ICONS[def.id]}
                  onChange={(next) =>
                    update((draft) => {
                      draft.essence[def.id] = next;
                    })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------- altars --

function Altar({ id, input, result, update }: Props & { id: AltarId }) {
  const def = ALTARS[id];
  const state = input.altars[id];
  const outcome = result.altars[id];
  const rows = result.rows.altars[id];
  const unlockRow = result.rows.altarUnlocks.find((r) => r.id === `${id}.unlock`);
  const needsUnlock = Object.keys(def.unlockCost).length > 0;

  return (
    <>
      <Subhead>
        <Icon src={ALTAR_ICONS[id]} size={18} />
        {def.label}
      </Subhead>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 16px 8px' }}>
        {needsUnlock ? (
          <Switch
            checked={state.unlocked}
            onChange={(next) =>
              update((draft) => {
                draft.altars[id].unlocked = next;
                if (!next) draft.altars[id].active = false;
              })
            }
          >
            Unlocked
          </Switch>
        ) : null}
        <Switch
          checked={state.active}
          onChange={(next) =>
            update((draft) => {
              draft.altars[id].active = next;
            })
          }
        >
          Running
        </Switch>
        {needsUnlock && !state.unlocked && unlockRow ? (
          <span className="note">
            Unlock costs <BundleAmount bundle={unlockRow.remaining} />
          </span>
        ) : null}
      </div>

      <div className="scroll-x">
        <table className="rows" role="table" aria-label={`${def.label} upgrades`}>
          {/* The altar grids repeat the same four columns as the essence table
              directly above them, so drawing the header three more times is
              noise — but without one the columns are unlabelled to anyone who
              cannot see that. Present for screen readers only. */}
          <thead className="sr-only" role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">
                Upgrade
              </th>
              <th role="columnheader" scope="col">
                Level
              </th>
              {/* Classed like the visible headers so the narrow-screen rule drops
                  it too — otherwise the header count stops matching the body and
                  a screen reader announces each cost cell as "Effect". */}
              <th role="columnheader" scope="col" className="effect">
                Effect
              </th>
              <th role="columnheader" scope="col">
                Next / Remaining
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup" className={state.unlocked ? undefined : 'locked'}>
            {rows.map((row, i) => {
              const up = def.upgrades[i]!;
              return (
                <CostRow
                  key={row.id}
                  row={row}
                  max={up.max}
                  onChange={(next) =>
                    update((draft) => {
                      draft.altars[id][up.key] = next;
                    })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="stats">
        <Stat label="Cycle" help="altarCycle" value={formatDuration(outcome.cycleTime)} />
        <Stat
          label="Runes / cycle"
          help="altarRunesPerCycle"
          value={formatNumber(outcome.runesPerCycle, 2)}
        />
        {/* The sustained rate is the one to plan on, so it takes the headline
            and the nominal rate drops to a footnote — but only when they
            differ, which is only when the pool cannot keep this altar fed. */}
        <Stat
          label={`${RESOURCE_LABELS[def.rune]}s / hr`}
          help="altarRunesPerHour"
          value={
            <>
              <span style={{ color: `var(--res-${def.rune})` }}>
                {formatNumber(outcome.sustainedRunesPerHour, 2)}
              </span>
              {outcome.supplyFactor < 1 ? (
                <span className="stat-note">
                  starved · {formatNumber(outcome.supplyFactor * 100, 0)}% of{' '}
                  {formatNumber(outcome.runesPerHour, 2)}
                </span>
              ) : null}
            </>
          }
        />
        <Stat
          label="Essence / hr"
          help="altarEssencePerHour"
          value={
            <span style={{ color: state.active && state.unlocked ? 'var(--ember)' : undefined }}>
              {state.active && state.unlocked ? '−' : ''}
              {formatNumber(outcome.essenceCostPerHour, 2)}
            </span>
          }
        />
      </dl>
    </>
  );
}

export function Altars(props: Props) {
  return (
    <Section
      title="Altars"
      icon={SECTION_ICONS.altars}
      help="runeCraftMulti"
      eyebrow={`rune craft ×${formatNumber(props.result.runeCraftMulti, 4)}`}
      flush
    >
      {ALTAR_IDS.map((id) => (
        <Altar key={id} id={id} {...props} />
      ))}
      <p className="note" style={{ padding: '10px 16px 14px' }}>
        Batch 2 also lists Drift and Echo altars. The supplied wiki page gives their unlocks
        (Drift: 20K Ash + 15K Brine + 10K Chasm; Echo: 100K Brine + 75K Chasm + 25K Drift)
        but no cycle stats or altar-upgrade cost tables, so their production math is not guessed here.
      </p>
    </Section>
  );
}

// ----------------------------------------------------------------- spells --

export function Spells({ input, result, update }: Props) {
  return (
    <Section title="Spells" icon={SECTION_ICONS.spells} eyebrow="runes" flush>
      <div className="scroll-x">
        <table className="rows spells" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">
                Spell
              </th>
              <th role="columnheader" scope="col">
                Level
              </th>
              <th role="columnheader" scope="col">
                Potency
              </th>
              <th role="columnheader" scope="col" className="effect">
                Effects
              </th>
              {/* "Potency" is dropped from the header and left to the help
                  popover, which is titled with it. Spelled out, this header was
                  the widest cell in the table — wider than any cost under it —
                  and on its own worth about 70px of sideways scroll. */}
              <th role="columnheader" scope="col" style={{ textAlign: 'right' }}>
                Next / Remaining <Help id="potencyCost" />
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {SPELL_IDS.map((id) => {
              const def = SPELLS[id];
              const state = input.spells[id];
              const outcome = result.spells[id];
              const row = result.rows.spells.find((r) => r.id === `${id}.potency`)!;

              return (
                <tr role="row" key={id} className={state.unlocked ? undefined : 'locked'}>
                  {/* Name above, toggle and icon below it. Inline, the three of
                      them made this the widest column in the table; stacked, it
                      is only as wide as the name, and the room that frees goes
                      to the effects beside it. */}
                  <td role="cell" className="name">
                    <div className="spell-id">
                      <span className="spell-label">{def.label}</span>
                      <span className="named">
                        <Switch
                          checked={state.unlocked}
                          label={`${def.label} unlocked`}
                          onChange={(next) =>
                            update((draft) => {
                              draft.spells[id].unlocked = next;
                            })
                          }
                        />
                        {/* The buff icon once you own it, the spell item until then. */}
                        <Icon
                          src={state.unlocked ? SPELL_ACTIVE_ICONS[id] : SPELL_ICONS[id]}
                          size={30}
                          dim={!state.unlocked}
                        />
                      </span>
                    </div>
                  </td>
                  <td role="cell" className="ctl" data-label="Level">
                    <LevelInput
                      value={state.level}
                      max={def.maxLevel}
                      label={`${def.label} spell`}
                      onChange={(next) =>
                        update((draft) => {
                          draft.spells[id].level = next;
                        })
                      }
                    />
                  </td>
                  <td role="cell" className="ctl" data-label="Potency">
                    <LevelInput
                      value={state.rank}
                      max={def.maxRank}
                      label={`${def.label} potency`}
                      onChange={(next) =>
                        update((draft) => {
                          draft.spells[id].rank = next;
                        })
                      }
                    />
                  </td>
                  <td role="cell" className="effect">
                    {def.primary.label} {formatPercent(outcome.primary)}
                    <br />
                    {def.secondary.label} {formatPercent(outcome.secondary)}
                    {def.secondary.feedsBack ? (
                      <span style={{ color: 'var(--brine)' }}> ↩</span>
                    ) : null}
                  </td>
                  <td role="cell" className="cost">
                    <CostPair next={row.next} remaining={row.remaining} />
                    <div className="submeta">
                      {formatDuration(outcome.duration)} ·{' '}
                      <span className="named tight">
                        {def.manaCost}
                        <Icon src={MISC_ICONS.mana} size={14} alt="mana" />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ padding: '10px 16px 14px' }}>
        ↩ marks effects that feed back into these numbers. Locked spells grant nothing. Batch 2
        lists Bug Magnet (+9% Coal Production, +10% Banked Lootbug Cap, 280s; 3 Mana + 40 Brine +
        10 Drift), but the supplied page has no potency-cost table for it. The other new spell rows
        still contain ??? values, so none are assigned invented ranks or costs here.
      </p>
    </Section>
  );
}

// --------------------------------------------------------------- exchange --

export function Exchange({ result, update }: Props) {
  return (
    <Section
      title="Exchange"
      icon={SECTION_ICONS.exchange}
      eyebrow="13 released upgrades"
      help="exchange"
      flush
    >
      <div className="scroll-x">
        <table className="rows" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">
                Upgrade
              </th>
              <th role="columnheader" scope="col">
                Level
              </th>
              <th role="columnheader" scope="col" className="effect">
                Effect
              </th>
              <th role="columnheader" scope="col" style={{ textAlign: 'right' }}>
                Next / Remaining
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {result.rows.exchange.map((row, i) => {
              const def = EXCHANGE_UPGRADES[i]!;
              return (
                <CostRow
                  key={row.id}
                  row={row}
                  max={def.max}
                  icon={EXCHANGE_UPGRADE_ICONS[def.id]}
                  onChange={(next) =>
                    update((draft) => {
                      draft.exchange[def.id] = next;
                    })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ padding: '10px 16px 14px' }}>
        All 13 released Exchange upgrades are listed. Costs use the current Arcanist wiki tables;
        only Essence Damage Per Arcane Card and Rune Craft Multiplier feed calculations on this page.
      </p>
    </Section>
  );
}

// -------------------------------------------------------------- read-outs --

export function Stats({ result }: { result: ArcanistResult }) {
  const s = result.stats;

  /*
   * The crit figures are built from what is printed, not from the engine's full
   * precision.
   *
   * Damage prints whole and the multipliers print to two places, so a reader
   * checking the tiles against each other has only those digits to work with.
   * Off the unrounded stats the answer was a point or two away from that
   * arithmetic — accurate, and reading as a typo. The engine keeps its
   * precision; only this readout rounds first, as the damage tile already did.
   */
  const damage = Math.round(s.damage);
  const critDamage = Number(s.critDamage.toFixed(2));
  const superCritDamage = Number(s.superCritDamage.toFixed(2));

  return (
    <Section title="Arcanist Stats" eyebrow="derived" flush>
      <dl className="stats">
        <Stat label="Damage" help="statDamage" value={formatNumber(damage)} />
        <Stat
          label="Attack every"
          help="statAttackInterval"
          value={formatDuration(s.attackInterval)}
        />
        <Stat label="Crit chance" help="statCritChance" value={formatPercent(s.critChance)} />
        {/* The multiplier stays the headline; the hit it produces rides beside
            it, so the Damage stat above has something to be read against. Both
            are pre-armour, as that one is. Super crit compounds the crit
            multiplier into its figure because that is the only way to reach it:
            a hit super crits by having crit first. */}
        <Stat
          label="Crit damage"
          help="statCritDamage"
          value={
            <>
              ×{formatNumber(critDamage, 2)}
              <span className="stat-aside">
                {formatNumber(Math.round(damage * critDamage))}
              </span>
            </>
          }
        />
        <Stat label="Super crit" help="statSuperCrit" value={formatPercent(s.superCritChance)} />
        <Stat
          label="Super crit dmg"
          help="statSuperCritDamage"
          value={
            <>
              ×{formatNumber(superCritDamage, 2)}
              <span className="stat-aside">
                {formatNumber(Math.round(damage * critDamage * superCritDamage))}
              </span>
            </>
          }
        />
        <Stat label="Armour pen" help="statArmorPen" value={formatNumber(s.armorPen)} />
        <Stat label="Stun negate" help="statStunNegate" value={formatPercent(s.stunNegate)} />
        <Stat label="Shiny chance" help="statShinyChance" value={formatPercent(s.shinyChance)} />
        <Stat label="Shiny bonus" help="statShinyBonus" value={`+${formatNumber(s.shinyBonus)}`} />
        <Stat
          label="Super shiny"
          help="statSuperShiny"
          value={formatPercent(s.superShinyChance)}
        />
        <Stat
          label="Brittle chance"
          help="statBrittleChance"
          value={formatPercent(s.brittleChance)}
        />
      </dl>
    </Section>
  );
}

