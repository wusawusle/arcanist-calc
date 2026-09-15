import { ALTARS, ALTAR_IDS, CARD_TIER_COUNT, SPELLS, SPELL_IDS } from '../../calc/constants';
import { ESSENCE_LABELS } from '../../calc/constants';
import type { ArcanistInput, ArcanistResult, CardTier, OrbCardId } from '../../calc/types';
import { CARD_TIERS, ESSENCE_TYPES, ORB_CARD_IDS } from '../../calc/types';
import { Section, Subhead } from '../components';
import {
  ALTAR_ICONS,
  CARD_BACKINGS,
  ESSENCE_CARD_ICONS,
  ORB_CARD_ICONS,
  SECTION_ICONS,
  SPELL_ACTIVE_ICONS,
} from '../icons';

export const TIER_LABELS: Record<CardTier, string> = {
  none: 'None',
  normal: 'Normal',
  gilded: 'Gilded',
  polychrome: 'Polychrome',
};

/**
 * One card: the tier's frame with the card's own art layered inside it, the
 * name above, and the tier picker below.
 *
 * A card you do not own has no frame to draw, so the slot reads "Locked"
 * instead of showing a frameless icon that would look like a bug.
 */
export function CardTile({
  name,
  art,
  tier,
  onChange,
}: {
  name: string;
  art: string;
  tier: CardTier;
  onChange: (next: CardTier) => void;
}) {
  return (
    <div className="card-tile" data-tier={tier}>
      <div className="card-name">{name}</div>
      <div className="card-art">
        {tier === 'none' ? (
          <span className="card-locked">Locked</span>
        ) : (
          <span className="card-frame">
            <img src={CARD_BACKINGS[tier]} alt="" aria-hidden="true" className="card-backing" />
            <img src={art} alt="" aria-hidden="true" className="card-inset" />
          </span>
        )}
      </div>
      <select
        value={tier}
        aria-label={`${name} card tier`}
        onChange={(e) => onChange(e.target.value as CardTier)}
      >
        {CARD_TIERS.map((t) => (
          <option key={t} value={t}>
            {TIER_LABELS[t]}
          </option>
        ))}
      </select>
    </div>
  );
}

interface Props {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

export function Cards({ input, result, update }: Props) {
  const { cards } = input.external;

  const orbLabels: Record<OrbCardId, string> = {
    white: 'White Orb',
    green: 'Green Orb',
    purple: 'Purple Orb',
    orange: 'Orange Orb',
    red: 'Red Orb',
    yellow: 'Yellow Orb',
  };

  const owned = result.derived.arcaneCardCount;
  const max =
    (ESSENCE_TYPES.length + ALTAR_IDS.length + SPELL_IDS.length + ORB_CARD_IDS.length) *
    CARD_TIER_COUNT.polychrome;

  return (
    <Section
      title="Cards"
      icon={SECTION_ICONS.cards}
      eyebrow={`${owned} / ${max} tiers owned`}
      flush
    >
      <p className="note" style={{ padding: '10px 16px 0' }}>
        Tiers are cumulative — pick the highest you own. Arcanist cards stop at Polychrome. The
        tier count above drives Essence Damage Per Arcane Card.
      </p>

      <Subhead>Essence · max loot</Subhead>
      <div className="card-grid">
        {ESSENCE_TYPES.map((type) => (
          <CardTile
            key={type}
            name={ESSENCE_LABELS[type]}
            art={ESSENCE_CARD_ICONS[type]}
            tier={cards.essence[type]}
            onChange={(next) =>
              update((draft) => {
                draft.external.cards.essence[type] = next;
              })
            }
          />
        ))}
      </div>

      <Subhead>Runes · altar craft multiplier</Subhead>
      <div className="card-grid">
        {ALTAR_IDS.map((id) => (
          <CardTile
            key={id}
            name={ALTARS[id].label.replace(' Altar', ' Rune')}
            art={ALTAR_ICONS[id]}
            tier={cards.rune[id]}
            onChange={(next) =>
              update((draft) => {
                draft.external.cards.rune[id] = next;
              })
            }
          />
        ))}
      </div>

      <Subhead>Spells · spell effect</Subhead>
      <div className="card-grid">
        {SPELL_IDS.map((id) => (
          <CardTile
            key={id}
            name={SPELLS[id].label}
            art={SPELL_ACTIVE_ICONS[id]}
            tier={cards.spell[id]}
            onChange={(next) =>
              update((draft) => {
                draft.external.cards.spell[id] = next;
              })
            }
          />
        ))}
      </div>

      <Subhead>Orbs · trade multiplier</Subhead>
      <div className="card-grid">
        {ORB_CARD_IDS.map((id) => (
          <CardTile
            key={id}
            name={orbLabels[id]}
            art={ORB_CARD_ICONS[id]}
            tier={cards.orb[id]}
            onChange={(next) =>
              update((draft) => {
                draft.external.cards.orb[id] = next;
              })
            }
          />
        ))}
      </div>
      <p className="note" style={{ padding: '4px 16px 16px' }}>
        Orb cards change no Arcanist numbers, but they are Arcanist cards, so they count toward the
        tier total.
      </p>
    </Section>
  );
}
