import { RESOURCE_GROUPS } from '../../calc/constants';
import { formatCostLong } from '../../calc/format';
import type { ArcanistResult } from '../../calc/types';
import { ResourceName, Section } from '../components';

/**
 * Everything still owed to finish every priced upgrade.
 *
 * Only resources something can actually cost are listed. The restored Exchange
 * costs therefore bring stars, prestige points, veins, essence and Blue Cow
 * back into this ledger when a released row spends them.
 */
export function Totals({ result }: { result: ArcanistResult }) {
  const { remaining, total, spendable } = result.totals;
  const shown = new Set(spendable);

  const groups = RESOURCE_GROUPS.map((group) => ({
    label: group.label,
    resources: group.resources.filter((r) => shown.has(r)),
  })).filter((group) => group.resources.length > 0);

  return (
    <Section title="Total Resources" help="totalsPanel" eyebrow="to max everything" flush>
      <div className="scroll-x">
        <table className="matrix">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Remaining</th>
              <th>Full cost</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.label}>
              <tr>
                <td colSpan={3} className="group">
                  {group.label}
                </td>
              </tr>
              {group.resources.map((resource) => (
                <tr key={resource}>
                  <td>
                    <ResourceName resource={resource} />
                  </td>
                  <td
                    style={{ color: remaining[resource] > 0 ? 'var(--text)' : 'var(--text-faint)' }}
                  >
                    {formatCostLong(resource, remaining[resource])}
                  </td>
                  <td style={{ color: 'var(--text-faint)' }}>
                    {formatCostLong(resource, total[resource])}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Section>
  );
}
