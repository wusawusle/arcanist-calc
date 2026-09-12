import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ALTAR_IDS,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  SPELL_IDS,
} from '../calc/constants';
import { ESSENCE_TYPES, ORB_CARD_IDS } from '../calc/types';
import * as ICONS from './icons';
import {
  ALTAR_ICONS,
  CARD_BACKINGS,
  ESSENCE_CARD_ICONS,
  ESSENCE_ICONS,
  ESSENCE_UPGRADE_ICONS,
  EXCHANGE_UPGRADE_ICONS,
  ORB_CARD_ICONS,
  PET_ICONS,
  SPELL_ACTIVE_ICONS,
  SPELL_ICONS,
  UNLOCK_ICONS,
} from './icons';

/**
 * A missing icon is a silent broken image at runtime, so every path in the
 * catalog is checked against public/icons/ here rather than discovered in a
 * screenshot.
 */
/**
 * Every icon path the module exports, gathered from the module itself rather
 * than from a hand-written list — a list has to be remembered, and forgetting
 * to extend it makes this suite pass vacuously for the icons it should guard.
 */
const everyIcon = Object.values(ICONS)
  .filter((value): value is Record<string, string> => typeof value === 'object' && value !== null)
  .flatMap((group) => Object.values(group))
  .filter((value): value is string => typeof value === 'string' && value.includes('/icons/'));

const fileFor = (url: string) => join('public', 'icons', url.split('/').pop()!);

describe('icon catalog', () => {
  it('points every entry at a file that exists', () => {
    const missing = [...new Set(everyIcon)].filter((url) => !existsSync(fileFor(url)));
    expect(missing, 'icons with no file in public/icons').toEqual([]);
  });

  it('gathers icons from every exported catalog', () => {
    // Guards the gathering above: if it silently stopped finding groups, the
    // existence check would pass on an empty list.
    expect(everyIcon.length).toBeGreaterThan(50);
    expect(everyIcon).toContain(PET_ICONS.rhinoSkin);
    expect(everyIcon).toContain(UNLOCK_ICONS.arcanistBundle);
    expect(everyIcon).toContain(CARD_BACKINGS.polychrome);
  });

  it('covers every upgrade, spell, altar and essence type', () => {
    for (const type of ESSENCE_TYPES) {
      expect(ESSENCE_ICONS[type], type).toBeTruthy();
      expect(ESSENCE_CARD_ICONS[type], `${type} card`).toBeTruthy();
    }
    for (const id of ALTAR_IDS) expect(ALTAR_ICONS[id], id).toBeTruthy();
    for (const id of SPELL_IDS) {
      expect(SPELL_ICONS[id], id).toBeTruthy();
      expect(SPELL_ACTIVE_ICONS[id], `${id} active`).toBeTruthy();
    }
    for (const def of ESSENCE_UPGRADES) {
      expect(ESSENCE_UPGRADE_ICONS[def.id], def.id).toBeTruthy();
    }
    for (const def of EXCHANGE_UPGRADES) {
      expect(EXCHANGE_UPGRADE_ICONS[def.id], def.id).toBeTruthy();
    }
    for (const id of ORB_CARD_IDS) expect(ORB_CARD_ICONS[id], `${id} orb card`).toBeTruthy();
    for (const tier of ['normal', 'gilded', 'polychrome'] as const) {
      expect(CARD_BACKINGS[tier], `${tier} backing`).toBeTruthy();
    }
  });

  it('serves icons under the configured base path', () => {
    for (const url of everyIcon) expect(url).toMatch(/\/icons\/[^/]+\.png$/);
  });
});
