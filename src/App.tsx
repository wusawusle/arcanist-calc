import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { compute } from './calc/engine';
import type { ArcanistInput } from './calc/types';
import { EXAMPLE_INPUT } from './presets/example';
import { FRESH_INPUT } from './presets/fresh';
import { exportToFile, importFromFile, loadBuild, saveBuild } from './state/storage';
import { buildShareUrl, readBuildFromHash } from './state/url';
import { Contracts, Pets, Unlocks } from './ui/sections/Account';
import { Breakdown } from './ui/sections/Breakdown';
import { Cards } from './ui/sections/Cards';
import { Ledger } from './ui/sections/Ledger';
import { Optimizer } from './ui/sections/Optimizer';
import { Totals } from './ui/sections/Totals';
import { Altars, EssenceUpgrades, Exchange, Spells, Stats } from './ui/sections/Upgrades';

export default function App() {
  // A shared link wins over whatever was autosaved locally. Resolved during
  // initialisation so the page never renders the wrong build first.
  const [shared] = useState(() => readBuildFromHash(window.location.hash));
  const [input, setInput] = useState<ArcanistInput>(() =>
    shared.status === 'ok' ? shared.input : (loadBuild() ?? FRESH_INPUT),
  );
  const [toast, setToast] = useState<string | null>(() => {
    if (shared.status === 'ok') return 'Loaded build from link';
    if (shared.status === 'invalid') return "That link couldn't be read — showing your own build";
    return null;
  });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveBuild(input);
  }, [input]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const update = useCallback((mutate: (draft: ArcanistInput) => void) => {
    setInput((current) => {
      const draft = structuredClone(current);
      mutate(draft);
      return draft;
    });
  }, []);

  const result = useMemo(() => compute(input), [input]);

  const share = async () => {
    const url = buildShareUrl(input);
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copied to clipboard');
    } catch {
      setToast('Link is in the address bar');
    }
  };

  const load = (next: ArcanistInput, message: string) => {
    setInput(next);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setToast(message);
  };

  const sectionProps = { input, result, update };

  return (
    <div className="app">
      <header className="masthead">
        <h1>Arcanist</h1>
        <span className="sub">Idle Obelisk Miner · Ob70 planner</span>
        <div className="actions">
          <button className="action" type="button" onClick={() => load(FRESH_INPUT, 'Reset to a fresh account')}>
            Reset
          </button>
          <button
            className="action"
            type="button"
            onClick={() => load(EXAMPLE_INPUT, 'Loaded the example build')}
          >
            Load example
          </button>
          <button className="action" type="button" onClick={() => exportToFile(input)}>
            Export
          </button>
          <button className="action" type="button" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <button className="action primary" type="button" onClick={share}>
            Share link
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                load(await importFromFile(file), `Imported ${file.name}`);
              } catch {
                setToast('That file is not a build export');
              }
            }}
          />
        </div>
      </header>

      <Ledger input={input} result={result} update={update} />

      {/* Left column takes every input; the right is read-only output only. */}
      <div className="columns">
        <div className="stack">
          <EssenceUpgrades {...sectionProps} />
          <Altars {...sectionProps} />
          <Spells {...sectionProps} />
          <Exchange {...sectionProps} />
          <Cards {...sectionProps} />
          <Pets {...sectionProps} />
          <Unlocks {...sectionProps} />
          <Contracts {...sectionProps} />
        </div>

        <div className="stack">
          <Optimizer input={input} result={result} />
          <Stats result={result} />
          <Breakdown result={result} />
          <Totals result={result} />
        </div>
      </div>

      <footer className="colophon">
        <p>
          Based on the Arcanist sheet from{' '}
          <a
            href="https://docs.google.com/spreadsheets/d/1hj4YvYYNlAmXD9LHZNsDQS2n1pFI8H34_1-RS_RlU-E/edit?usp=sharing"
            target="_blank"
            rel="noreferrer noopener"
          >
            Obelisk Total Resources Calculator
          </a>{' '}
          by <strong>Stonestriker</strong> — heavily modified. The formulas are
          their work; this page ports and extends them.
        </p>
        <p>
          <a
            href="https://github.com/OrionAF/iom-arcanist-optimizer"
            target="_blank"
            rel="noreferrer noopener"
          >
            Source on GitHub
          </a>
        </p>
      </footer>

      {/* The live region is always mounted and only its contents change. Creating
          a role="status" element at the same moment it gains text is a race some
          screen readers lose, and the announcement is dropped. */}
      <div role="status" aria-live="polite">
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}
