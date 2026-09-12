/**
 * Bonuses the Arcanist receives from the rest of the account: the Rhino pet,
 * one-off unlocks, and contract levels.
 *
 * Each control is the thing the player owns — a pet level, an unlock, a card
 * tier — rather than the derived number the workbook stored, so this can be
 * filled in by looking at the game.
 */

import { CONTRACT_RUNE_CRAFT, PET, UNLOCKS } from '../../calc/constants';
import { formatPercent } from '../../calc/format';
import type { ArcanistInput, ArcanistResult } from '../../calc/types';
import { Field, Icon, LevelInput, Section, Switch } from '../components';
import { MISC_ICONS, PET_ICONS, SECTION_ICONS, UNLOCK_ICONS } from '../icons';
import { CardTile } from './Cards';

interface Props {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

/** An unlock toggle with its icon and the effects it grants. */
function UnlockRow({
  icon,
  label,
  effects,
  checked,
  onChange,
  children,
}: {
  icon: string;
  label: string;
  effects: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={checked ? 'unlock on' : 'unlock'}>
      <Icon src={icon} size={28} dim={!checked} />
      <div className="unlock-body">
        <Switch checked={checked} onChange={onChange}>
          {label}
        </Switch>
        <div className="unlock-effects">{effects}</div>
        {children}
      </div>
    </div>
  );
}

export function Pets({ input, result, update }: Props) {
  const { pets } = input.external;
  const { derived } = result;

  return (
    <Section title="Pets" icon={SECTION_ICONS.pets} eyebrow="rhino" flush>
      <div className="pet-grid">
        <div className="pet-main">
          <Field
            label="Rhino Pet Level"
            hint={`+1% Essence Brittle Chance per level · now ${formatPercent(derived.petBrittle)}`}
          >
            <LevelInput
              value={pets.rhinoLevel}
              max={PET.maxLevel}
              label="Rhino Pet Level"
              onChange={(next) =>
                update((draft) => {
                  draft.external.pets.rhinoLevel = next;
                })
              }
            />
          </Field>

          <div className="unlock-list">
            <UnlockRow
              icon={PET_ICONS.rhinoSkin}
              label="Rhino Pet Skin"
              effects={`+${PET.skinMaxLoot} Essence Max Loot`}
              checked={pets.rhinoSkin}
              onChange={(next) =>
                update((draft) => {
                  draft.external.pets.rhinoSkin = next;
                })
              }
            />

            <UnlockRow
              icon={PET_ICONS.rhinoQuest}
              label="Rhino Quest Skin"
              effects={
                pets.rhinoQuestSkin
                  ? `Essence Shiny Chance ${formatPercent(
                      derived.petQuestShiny,
                    )} · Arcanist Spell Power ${formatPercent(derived.petSpellPower)}`
                  : 'Grants Essence Shiny Chance and Arcanist Spell Power once unlocked'
              }
              checked={pets.rhinoQuestSkin}
              onChange={(next) =>
                update((draft) => {
                  draft.external.pets.rhinoQuestSkin = next;
                })
              }
            >
              {pets.rhinoQuestSkin ? (
                <div className="unlock-sub">
                  <span>Level</span>
                  <LevelInput
                    value={pets.rhinoQuestLevel}
                    max={PET.maxQuestLevel}
                    label="Rhino Quest Skin level"
                    onChange={(next) =>
                      update((draft) => {
                        draft.external.pets.rhinoQuestLevel = next;
                      })
                    }
                  />
                </div>
              ) : null}
            </UnlockRow>
          </div>
        </div>

        <div className="pet-card">
          <CardTile
            name="Rhino Pet"
            art={PET_ICONS.rhino}
            tier={pets.rhinoCard}
            onChange={(next) =>
              update((draft) => {
                draft.external.pets.rhinoCard = next;
              })
            }
          />
          <p className="note">
            Essence Super Shiny Chance. Not one of the Arcanist card blocks, so it does not count
            toward Arcane Card damage.
          </p>
        </div>
      </div>
    </Section>
  );
}

export function Unlocks({ input, update }: Props) {
  const { unlocks } = input.external;
  const set = <K extends keyof typeof unlocks>(key: K, value: (typeof unlocks)[K]) =>
    update((draft) => {
      draft.external.unlocks[key] = value;
    });

  const pct = (n: number) => formatPercent(n);

  return (
    <Section title="Unlocks" icon={SECTION_ICONS.unlocks} eyebrow="account-wide">
      <div className="unlock-list">
        <UnlockRow
          icon={UNLOCK_ICONS.worldQuest25}
          label="World Quest 25 completed"
          effects={`+${pct(UNLOCKS.worldQuest25Shiny)} Essence Shiny Chance`}
          checked={unlocks.worldQuest25}
          onChange={(v) => set('worldQuest25', v)}
        />
        <UnlockRow
          icon={UNLOCK_ICONS.worldQuest29}
          label="World Quest 29 completed"
          effects={`+${pct(UNLOCKS.worldQuest29SuperShiny)} Essence Super Shiny Chance`}
          checked={unlocks.worldQuest29}
          onChange={(v) => set('worldQuest29', v)}
        />
        <UnlockRow
          icon={UNLOCK_ICONS.straightOuttaYanille}
          label="Straight Outta Yanille"
          effects={`+10% Arcanist Mana Regen · +${pct(
            UNLOCKS.yanilleShiny,
          )} Essence Shiny Chance · +${pct(UNLOCKS.yanilleBrittle)} Essence Brittle Chance`}
          checked={unlocks.straightOuttaYanille}
          onChange={(v) => set('straightOuttaYanille', v)}
        />
        <UnlockRow
          icon={UNLOCK_ICONS.arcanistBundle}
          label="Arcanist Bundle"
          effects={`+${pct(UNLOCKS.bundleShiny)} Essence Shiny Chance · +${pct(
            UNLOCKS.bundleRuneCraft,
          )} Rune Craft Multi · +${pct(
            UNLOCKS.bundleSpellDuration,
          )} Spell Duration · +10% Wizard Loot Multi`}
          checked={unlocks.arcanistBundle}
          onChange={(v) => set('arcanistBundle', v)}
        />
        <UnlockRow
          icon={UNLOCK_ICONS.statueOfNature}
          label="Statue of Nature gilded"
          effects={`+${pct(
            UNLOCKS.statueSuperShinyPerStatue,
          )} Essence Super Shiny Chance per W4 gilded statue`}
          checked={unlocks.statueOfNatureGilded}
          onChange={(v) =>
            update((draft) => {
              draft.external.unlocks.statueOfNatureGilded = v;
              // Gilding the Statue of Nature is itself one of the nine.
              if (v) draft.external.unlocks.w4GildedStatues = Math.max(unlocks.w4GildedStatues, 1);
            })
          }
        >
          {unlocks.statueOfNatureGilded ? (
            <div className="unlock-sub">
              <span>W4 gilded statues owned</span>
              <LevelInput
                value={unlocks.w4GildedStatues}
                max={UNLOCKS.maxW4GildedStatues}
                label="W4 gilded statues owned"
                onChange={(v) => set('w4GildedStatues', v)}
              />
            </div>
          ) : null}
        </UnlockRow>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        Mana regen and Wizard Loot Multi are listed for completeness; neither feeds any number the
        Arcanist calculator produces.
      </p>
    </Section>
  );
}

export function Contracts({ input, result, update }: Props) {
  const level = input.external.contractRuneCraftLevel;

  return (
    <Section title="Contracts" icon={SECTION_ICONS.contracts}>
      <Field
        label="Rune Craft Multi"
        hint={`+${formatPercent(CONTRACT_RUNE_CRAFT.perLevel)} per level · now ${formatPercent(
          result.derived.contractRuneCraft,
        )}`}
      >
        <span className="named">
          <Icon src={MISC_ICONS.runeCraft} size={20} />
          <LevelInput
            value={level}
            max={CONTRACT_RUNE_CRAFT.maxLevel}
            label="Contract Rune Craft Multi"
            onChange={(next) =>
              update((draft) => {
                draft.external.contractRuneCraftLevel = next;
              })
            }
          />
        </span>
      </Field>
    </Section>
  );
}
