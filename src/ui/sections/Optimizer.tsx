import { useMemo } from 'react';

import { RESOURCE_LABELS } from '../../calc/constants';
import { formatCost, formatHours, formatNumber } from '../../calc/format';
import { groupRankings, rankAll, type Goal, type Marginal } from '../../calc/optimize';
import type { ArcanistInput, ArcanistResult } from '../../calc/types';
import { Icon, Section } from '../components';
import { RESOURCE_ICONS } from '../icons';

/**
 * What to buy next.
 *
 * Two lists rather than one, because the player has two goals and they do not
 * always agree: altar throughput buys runes with essence, so an upgrade can
 * climb one list while falling down the other. Collapsing them into a single
 * score would need a weighting nobody can supply honestly.
 *
 * Within a list, entries are grouped by the resource they cost. Resources are
 * not interchangeable, so a merged list would rank a white-orb price against a
 * rune price as though one could be swapped for the other. Grouped, each queue
 * answers the question the player actually arrives with: I have a pile of this,
 * what should it buy?
 */

/** Rows shown per resource before the queue is truncated. */
const PER_RESOURCE = 3;

function gainOf(entry: Marginal, goal: Goal): number {
  return goal === 'essence' ? entry.delta.essencePerHour : entry.delta.runesPerHour;
}

/**
 * One recommendation.
 *
 * The cost is the price of the step being ranked, not the row's cost to max.
 * That step is usually one level but not always: damage arrives in whole hits,
 * so the cheapest damage buy that does anything can be several levels, and the
 * `3→7` on the row is the purchase the gain and the price both refer to.
 *
 * The side-effect line appears only when the other objective moves the wrong
 * way — that is the tradeoff the two lists exist to expose, and it is worth
 * spelling out where it happens.
 */
function Entry({ entry, goal, rank }: { entry: Marginal; goal: Goal; rank: number }) {
  const gain = gainOf(entry, goal);
  const other = goal === 'essence' ? entry.delta.runesPerHour : entry.delta.essencePerHour;
  const otherUnit = goal === 'essence' ? 'rune/hr' : 'essence/hr';
  const amount = entry.candidate.resource
    ? entry.candidate.stepCost[entry.candidate.resource]
    : undefined;

  return (
    <li className="opt-entry">
      <span className="opt-rank num">{rank}</span>
      <span className="opt-body">
        <span className="opt-name">
          {entry.candidate.label}
          <span className="opt-level num">
            {entry.candidate.level}→{entry.candidate.to}
          </span>
        </span>
        {other < 0 ? (
          <span className="opt-tradeoff num">
            costs {formatNumber(Math.abs(other), 1)} {otherUnit}
          </span>
        ) : null}
      </span>
      <span className="opt-gain">
        <span className={`num${gain > 0 ? ' up' : gain < 0 ? ' down' : ''}`}>
          {gain > 0 ? '+' : ''}
          {formatNumber(gain, 1)}
        </span>
        {amount !== undefined && entry.candidate.resource ? (
          <span className="opt-cost num">
            {formatCost(entry.candidate.resource, amount)}
            {/* Only rune costs carry a time: orb income is not modelled. */}
            {entry.hoursToAfford !== undefined ? (
              <span className="opt-eta"> · {formatHours(entry.hoursToAfford)}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function GoalList({
  scored,
  goal,
  title,
}: {
  scored: Marginal[];
  goal: Goal;
  title: string;
}) {
  const ranked = useMemo(() => groupRankings(scored, goal), [scored, goal]);

  // An upgrade that moves this goal not at all is not a recommendation for it.
  const queues = ranked.byResource
    .map((queue) => ({
      ...queue,
      entries: queue.entries.filter((e) => gainOf(e, goal) > 0).slice(0, PER_RESOURCE),
    }))
    .filter((queue) => queue.entries.length > 0);

  // Rows with no price still belong in the goal they serve — running an idle
  // altar is usually the top move for runes — but they cannot be ranked against
  // priced rows, so they sit in their own group under the queues.
  const unpriced = ranked.unpriced.filter((e) => gainOf(e, goal) > 0).slice(0, PER_RESOURCE);

  return (
    <div className="opt-goal">
      <h3>{title}</h3>

      {queues.length === 0 && unpriced.length === 0 ? (
        <p className="opt-empty">Nothing available moves this goal right now.</p>
      ) : (
        queues.map((queue) => {
          const icon = RESOURCE_ICONS[queue.resource];
          return (
          <div className="opt-queue" key={queue.resource}>
            <div className="opt-queue-head">
              {icon ? (
                <Icon src={icon} size={15} />
              ) : (
                <span className="dot" style={{ ['--dot' as string]: `var(--res-${queue.resource})` }} />
              )}
              {RESOURCE_LABELS[queue.resource]}
            </div>
            <ol className="opt-list">
              {queue.entries.map((entry, i) => (
                <Entry key={entry.candidate.key} entry={entry} goal={goal} rank={i + 1} />
              ))}
            </ol>
          </div>
          );
        })
      )}

      {unpriced.length > 0 ? (
        <div className="opt-queue">
          <div className="opt-queue-head">No price</div>
          <ol className="opt-list">
            {unpriced.map((entry, i) => (
              <Entry key={entry.candidate.key} entry={entry} goal={goal} rank={i + 1} />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function Optimizer({ input, result }: { input: ArcanistInput; result: ArcanistResult }) {
  // Scored once for both lists: the recomputes are the expensive part and they
  // do not depend on the goal — only the ordering does.
  const scored = useMemo(() => rankAll(input, result), [input, result]);

  return (
    <Section title="Optimizer" help="optimizer" eyebrow="best next buys · per hour gained">
      <div className="opt-goals">
        <GoalList scored={scored} goal="essence" title="For essence / hr" />
        <GoalList scored={scored} goal="runes" title="For runes / hr" />
      </div>
    </Section>
  );
}
