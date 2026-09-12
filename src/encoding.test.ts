import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guards against mojibake: UTF-8 bytes decoded as latin-1 and re-encoded, which
 * turns a middot into "A-with-circumflex + middot" and an em dash into three
 * garbage characters.
 *
 * This is not hypothetical — a bulk find-and-replace through a tool that
 * guessed the wrong input encoding did exactly this, and it stayed invisible
 * until the corrupted separator turned up in a screenshot of the running app.
 *
 * The pattern is built from char codes rather than written literally, because
 * a literal version would make this file trip its own check.
 */
const LEAD = [0xc2, 0xc3, 0xe2].map((c) => String.fromCharCode(c)).join('');
const MOJIBAKE = new RegExp(
  `[${LEAD}][${String.fromCharCode(0x80)}-${String.fromCharCode(0xbf)}]`,
);

const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.json', '.md']);

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (EXTENSIONS.has(extname(entry))) found.push(path);
  }
  return found;
}

describe('source encoding', () => {
  it('detects mojibake when it is present', () => {
    expect(MOJIBAKE.test(`Flat Damage +0 ${String.fromCharCode(0xc2, 0xb7)} Stun Negate`)).toBe(
      true,
    );
    expect(MOJIBAKE.test('Flat Damage +0 · Stun Negate')).toBe(false);
  });

  it('finds none in any source file', () => {
    const damaged = sourceFiles('src')
      .concat(sourceFiles('tools'))
      .filter((path) => MOJIBAKE.test(readFileSync(path, 'utf8')));

    expect(damaged, 'files with double-encoded UTF-8').toEqual([]);
  });
});
