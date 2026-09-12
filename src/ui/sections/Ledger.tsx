import { useEffect, useRef, useState } from 'react';

import { ESSENCE_LABELS } from '../../calc/constants';
import { formatNumber } from '../../calc/format';
import type { ArcanistInput, ArcanistResult, EssenceType } from '../../calc/types';
import { ESSENCE_TYPES } from '../../calc/types';
import { Help, Icon, useFlashOnChange } from '../components';
import { ESSENCE_ICONS } from '../icons';

/**
 * The three essences, and which one you are mining.
 *
 * The spreadsheet showed one at a time behind a dropdown because it ran out of
 * room; all three are computed either way, so all three are shown. What the
 * sheet never modelled is that you can only mine one of them at once — so the
 * other two are showing an income you are not receiving.
 *
 * Rather than add a separate control for that, the cells *are* the control:
 * click one to mine it. The mined cell shows what you are banking; the others
 * dim and label themselves "if you switched", which is what those numbers have
 * always actually meant.
 */
function LedgerCell({
  type,
  result,
  mining,
  onMine,
}: {
  type: EssenceType;
  result: ArcanistResult;
  mining: boolean;
  onMine: () => void;
}) {
  const outcome = result.essence[type];
  // The banked figure while mining this; the hypothetical net otherwise.
  const headline = mining ? outcome.sustainedNet : outcome.netEssencePerHour;
  const flash = useFlashOnChange(headline);

  const keptPct =
    outcome.essencePerHour > 0
      ? Math.max(0, Math.min(1, headline / outcome.essencePerHour)) * 100
      : 0;

  return (
    <div className="ledger-cell" data-type={type} data-mining={mining ? '' : undefined}>
      {/* A full-bleed click target rather than a <button> wrapping the cell:
          the cell contains its own "?" buttons, and a button cannot nest. This
          sits under the content and above the background, so clicking anywhere
          that is not a "?" picks this essence. */}
      <button
        type="button"
        className="ledger-pick"
        aria-pressed={mining}
        aria-label={`Mine ${ESSENCE_LABELS[type]}`}
        onClick={onMine}
      />

      <div className="ledger-head">
        <Icon src={ESSENCE_ICONS[type]} size={18} />
        {ESSENCE_LABELS[type]}
        <span className="ledger-tag">{mining ? 'mining' : 'if you switched'}</span>
      </div>

      {outcome.unmineable ? (
        <div className="ledger-blocked">
          <strong>Can't mine</strong>
          {outcome.armor >= result.stats.damage
            ? `Armour ${formatNumber(outcome.armor)} meets or beats your ${formatNumber(
                result.stats.damage,
              )} damage.`
            : `Regen ${formatNumber(outcome.avgRegen)}/hit outpaces your damage after armour.`}
        </div>
      ) : (
        <>
          <div className="ledger-net">
            <span className={`num value${flash ? ' flash' : ''}${headline < 0 ? ' negative' : ''}`}>
              {formatNumber(headline, 2)}
            </span>
            <span className="unit">net / hr</span>
            <Help id="ledgerNet" />
          </div>

          <div className="drainbar" aria-hidden="true">
            <span className="kept" style={{ width: `${keptPct}%` }} />
            <span className="drained" style={{ width: `${100 - keptPct}%` }} />
          </div>

          <div className="ledger-lines">
            <div>
              <span>
                Income <Help id="ledgerIncome" />
              </span>
              <span className="num">{formatNumber(outcome.essencePerHour, 2)}</span>
            </div>
            <div className="drain">
              <span>
                Altar drain <Help id="ledgerDrain" />
              </span>
              <span className="num">
                {outcome.altarDrain > 0 ? `−${formatNumber(outcome.altarDrain, 2)}` : '0'}
              </span>
            </div>
            <div>
              <span>
                Blocks / hr <Help id="ledgerBlocks" />
              </span>
              <span className="num">{formatNumber(outcome.blocksPerHour, 2)}</span>
            </div>
            {/* The spread behind the income figure. A single block pays
                anywhere in this range, and the hourly number above is the
                average of a hundred of them — without this, a run of minimum
                rolls reads as the calculator being wrong. */}
            <div>
              <span>
                Loot / block <Help id="ledgerLootRange" />
              </span>
              <span className="num">
                {formatNumber(outcome.minLoot)}–{formatNumber(outcome.luckiestLoot)}
                <span className="avg">avg {formatNumber(outcome.trueLootAvg, 2)}</span>
              </span>
            </div>
          </div>

          {/* Only worth saying where it is a surprise: the altars on this pool
              want more than you can mine, so they are running at part rate. */}
          {mining && outcome.altarDrain > outcome.essencePerHour ? (
            <div className="ledger-starved">
              Altars want {formatNumber(outcome.altarDrain, 0)}/hr — they run at{' '}
              {formatNumber((outcome.essencePerHour / outcome.altarDrain) * 100, 0)}% and you bank
              nothing.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** What a cell's headline says, or an em dash where there is no rate to state. */
function headlineOf(result: ArcanistResult, type: EssenceType, mining: boolean): number | null {
  const outcome = result.essence[type];
  if (outcome.unmineable) return null;
  return mining ? outcome.sustainedNet : outcome.netEssencePerHour;
}

/**
 * The mined figure, kept on screen after the ledger has scrolled away.
 *
 * On a wide screen the ledger itself is sticky and this never appears. On a
 * phone it cannot be: three stacked cells are some 600px of an 844px viewport.
 * But the whole app is "change a level, watch net/hr move", and the mobile page
 * runs to about 10,000px — so without this the number being optimised is nine
 * screens above the control that changes it, and the flash-on-change fires
 * where nobody can see it.
 *
 * The other two essences ride along as chips, because switching what you mine
 * is the one ledger interaction worth keeping within reach.
 */
function LedgerRail({
  input,
  result,
  update,
  shown,
}: {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
  shown: boolean;
}) {
  const mining = input.mining;
  const headline = headlineOf(result, mining, true);
  const flash = useFlashOnChange(headline ?? 0);

  const toLedger = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <div className={shown ? 'ledger-rail is-shown' : 'ledger-rail'} data-type={mining}>
      <button type="button" className="rail-current" onClick={toLedger}>
        <Icon src={ESSENCE_ICONS[mining]} size={18} />
        <span className="rail-name">{ESSENCE_LABELS[mining]}</span>
        <span
          className={`num rail-value${flash ? ' flash' : ''}${
            headline !== null && headline < 0 ? ' negative' : ''
          }`}
        >
          {headline === null ? '—' : formatNumber(headline, 2)}
        </span>
        <span className="rail-unit">net / hr</span>
      </button>

      <div className="rail-others">
        {ESSENCE_TYPES.filter((type) => type !== mining).map((type) => {
          const value = headlineOf(result, type, false);
          return (
            <button
              key={type}
              type="button"
              className="rail-chip"
              data-type={type}
              aria-label={`Mine ${ESSENCE_LABELS[type]}`}
              onClick={() =>
                update((draft) => {
                  draft.mining = type;
                })
              }
            >
              <Icon src={ESSENCE_ICONS[type]} size={15} />
              <span className="num">{value === null ? '—' : formatNumber(value, 0)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Ledger({
  input,
  result,
  update,
}: {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);

  /*
   * An observer rather than a scroll handler: this fires twice per visit to the
   * boundary instead of on every frame of every scroll, and it needs no layout
   * reads of its own. The `top < 0` test distinguishes "scrolled up past the
   * ledger", where the rail belongs, from "not yet scrolled down to it", which
   * happens while the page is still settling.
   */
  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="ledger" role="group" aria-label="Essence being mined">
        {ESSENCE_TYPES.map((type) => (
          <LedgerCell
            key={type}
            type={type}
            result={result}
            mining={input.mining === type}
            onMine={() =>
              update((draft) => {
                draft.mining = type;
              })
            }
          />
        ))}
      </div>

      <div ref={sentinel} className="ledger-sentinel" aria-hidden="true" />
      <LedgerRail input={input} result={result} update={update} shown={past} />
    </>
  );
}
