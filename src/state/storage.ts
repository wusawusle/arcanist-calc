/**
 * localStorage autosave and JSON export/import.
 *
 * Every read is defensive: a corrupt or stale entry must degrade to "no saved
 * build" rather than a blank screen.
 */

import type { ArcanistInput } from '../calc/types';
import { SCHEMA_VERSION, fromSavedBuild, toSavedBuild } from './schema';

const STORAGE_KEY = 'iom-arcanist-optimizer:build';
const PANELS_KEY = 'iom-arcanist-optimizer:panels';

export function loadBuild(): ArcanistInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return fromSavedBuild(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveBuild(input: ArcanistInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSavedBuild(input)));
  } catch {
    // Private mode or a full quota: autosave is a convenience, not a requirement.
  }
}

export function clearBuild(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Which panels are open, keyed by panel id.
 *
 * Kept out of the build so it never travels in a share link or an export — how
 * someone has arranged their own screen is not part of the build they are
 * sharing. A missing entry means "whatever the panel's default is", so adding a
 * panel does not need a migration.
 */
export function loadPanels(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function savePanel(id: string, open: boolean): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify({ ...loadPanels(), [id]: open }));
  } catch {
    // Same bargain as the build autosave: a convenience, not a requirement.
  }
}

export function exportToFile(input: ArcanistInput): void {
  const blob = new Blob([JSON.stringify(toSavedBuild(input), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `arcanist-build-v${SCHEMA_VERSION}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File): Promise<ArcanistInput> {
  const text = await file.text();
  return fromSavedBuild(JSON.parse(text));
}
