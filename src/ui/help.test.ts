/**
 * Glossary tests.
 *
 * The help text is the only place the app explains itself in prose, so it is
 * the easiest place for the vocabulary to drift. Two things are pinned: that
 * every entry is actually usable, and that the retired combat words stay
 * retired.
 *
 * The Arcanist mines essence blocks. It does not fight enemies and nothing
 * dies — that framing came from the source workbook's column names and read as
 * though the calculator were describing a different game.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HELP, type HelpEntry } from './help';

// Widened: HELP is `as const`, which narrows each entry to its own literal
// shape and hides `formula` on the ones that lack it.
const entries = Object.entries(HELP) as [string, HelpEntry][];

/**
 * Every .ts/.tsx file under src/, minus the glossary itself and the tests.
 *
 * Excluding help.ts is what makes the orphan check mean anything: its own keys
 * are declared unquoted, and every use site writes them quoted, so a key found
 * in this text is a key something actually renders.
 */
function sources(dir = join(import.meta.dirname, '..')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return sources(path);
    if (!/\.tsx?$/.test(item.name)) return [];
    return /\.test\.tsx?$/.test(item.name) || item.name === 'help.ts' ? [] : [path];
  });
}

const useSites = sources()
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

describe('glossary', () => {
  it('has a title and a real explanation for every entry', () => {
    for (const [id, entry] of entries) {
      expect(entry.title.trim(), `${id} title`).not.toBe('');
      // Short enough to be a label rather than an explanation is a bug: the
      // reader clicked "?" because the label was not enough.
      expect(entry.body.trim().length, `${id} body`).toBeGreaterThan(40);
    }
  });

  it('is all reachable — no entry without a "?" that shows it', () => {
    const orphans = entries
      .map(([id]) => id)
      .filter((id) => !new RegExp(`["']${id}["']`).test(useSites));
    expect(orphans).toEqual([]);
  });

  /**
   * Words from the workbook's combat framing. The game is mining essence
   * blocks: blocks are broken and mined, they are not enemies and they do not
   * die. `health`, `damage`, `crit` and `attack` all stay — those are the
   * game's own words for what a pickaxe does to a block.
   */
  it('uses the mining vocabulary, not the combat one', () => {
    const retired = /\benem(y|ies)\b|\bkills?\b|\bkilling\b|\bkilled\b|unkillable|\bdies\b|\bcorpse\b/i;

    const offenders = entries
      .filter(([, entry]) => retired.test(`${entry.title} ${entry.body} ${entry.formula ?? ''}`))
      .map(([id]) => id);

    expect(offenders).toEqual([]);
  });

  it('keeps that vocabulary in the labels the entries sit beside', () => {
    // The glossary is consistent on its own only if the UI around it is too.
    const ui = ['sections/Breakdown.tsx', 'sections/Ledger.tsx']
      .map((name) => readFileSync(join(import.meta.dirname, name), 'utf8'))
      .join('\n');

    expect(ui).not.toMatch(/label="[^"]*\bkill/i);
    expect(ui).not.toMatch(/\bEnemy stats\b/);
  });
});
