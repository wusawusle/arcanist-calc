import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { RESOURCE_LABELS } from '../calc/constants';
import { formatCost } from '../calc/format';
import type { Resource, ResourceBundle } from '../calc/types';
import { loadPanels, savePanel } from '../state/storage';
import { HELP, type HelpEntry, type HelpId } from './help';
import { RESOURCE_ICONS } from './icons';

// ----------------------------------------------------------------- icons ---

/**
 * A game icon.
 *
 * Decorative by default: these sit beside a text label that already says what
 * the row is, so announcing the image again is noise. Pass `alt` only when the
 * icon is the sole identifier.
 */
export function Icon({
  src,
  size = 20,
  alt = '',
  dim,
}: {
  src: string;
  size?: number;
  alt?: string;
  dim?: boolean;
}) {
  return (
    <img
      className={dim ? 'icon dim' : 'icon'}
      src={src}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}

// ------------------------------------------------------------------- help --

/** Where an open popover sits. Anchored above the mark when below it would clip. */
interface Spot {
  left: number;
  top?: number;
  bottom?: number;
}

const POP_WIDTH = 320;

function spotFor(mark: HTMLElement): Spot {
  const r = mark.getBoundingClientRect();
  const left = Math.min(
    Math.max(r.left + r.width / 2 - POP_WIDTH / 2, 8),
    Math.max(window.innerWidth - POP_WIDTH - 8, 8),
  );
  // Flip upward in the bottom half of the viewport, where a downward panel
  // would run off the screen.
  return r.bottom > window.innerHeight * 0.6
    ? { left, bottom: window.innerHeight - r.top + 8 }
    : { left, top: r.bottom + 8 };
}

/**
 * The "?" beside a label, and the explanation behind it.
 *
 * Rendered into `document.body` rather than in place: these marks sit inside
 * table headers and horizontally scrolling panels, and a popover positioned
 * within those would be clipped by their own overflow. Fixed positioning
 * measured from the mark avoids that entirely, at the cost of having to close
 * on scroll — which is the right behaviour anyway, since the anchor moves.
 */
export function Help({ id }: { id: HelpId }) {
  // Widened deliberately: HELP is `as const` so its keys type HelpId, which
  // also narrows each entry to its own literal shape and hides `formula` on the
  // ones that lack it.
  const entry: HelpEntry = HELP[id];
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const mark = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  /*
   * Scrolling repositions the popover rather than dismissing it.
   *
   * Dismissing looks tidier and is wrong: clicking a mark that is only half in
   * view makes the browser scroll it into view to focus it, which fired the
   * dismissal before the popover had been seen at all. Following the anchor has
   * no such race, and is better behaviour besides. It closes only when the
   * anchor leaves the viewport, where there is nothing left to point at.
   */
  useEffect(() => {
    if (!open) return;

    const place = () => {
      const el = mark.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) setOpen(false);
      else setSpot(spotFor(el));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      mark.current?.focus();
    };

    place();
    // Capture, so scrolling any ancestor moves it and not just the page.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={mark}
        type="button"
        className="help-mark"
        aria-label={`What is ${entry.title}?`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={(e) => {
          // These marks sit inside <summary> elements; without this, asking what
          // a section is would also collapse it.
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        ?
      </button>
      {open && spot
        ? createPortal(
            <>
              <div className="help-scrim" onPointerDown={close} />
              <div
                id={panelId}
                className="help-pop"
                role="note"
                style={{ left: spot.left, top: spot.top, bottom: spot.bottom }}
              >
                <h4>{entry.title}</h4>
                {entry.body.split('\n\n').map((para) => (
                  <p key={para}>{para}</p>
                ))}
                {entry.formula ? <code className="help-formula">{entry.formula}</code> : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

// ------------------------------------------------------------------ shell --

/**
 * Every panel on the page, and all of them fold away.
 *
 * A `<details>` rather than a hand-rolled disclosure so the header is a real
 * button to a screen reader and browser find-in-page can still reach collapsed
 * content. Open state is remembered per panel — the page is long enough that
 * re-collapsing the six sections you never look at, on every visit, is a chore.
 *
 * State lives outside the build on purpose: how someone has arranged their own
 * screen is not part of the build a share link carries.
 */
export function Section({
  title,
  icon,
  eyebrow,
  help,
  flush,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: string;
  eyebrow?: ReactNode;
  help?: HelpId;
  flush?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => loadPanels()[title] ?? defaultOpen);

  return (
    <details
      className="section"
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (next === open) return;
        setOpen(next);
        savePanel(title, next);
      }}
    >
      <summary>
        {icon ? <Icon src={icon} size={22} /> : null}
        <h2>{title}</h2>
        {help ? <Help id={help} /> : null}
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      </summary>
      <div className={flush ? 'body flush' : 'body'}>{children}</div>
    </details>
  );
}

export function Subhead({ children }: { children: ReactNode }) {
  return (
    <div className="subhead">
      <span className="named">{children}</span>
      <span className="rule" />
    </div>
  );
}

// ----------------------------------------------------------------- inputs --

/**
 * Shows zero as a placeholder rather than a literal "0", so a field at its
 * default can be typed into without clearing it first.
 *
 * Needs a local draft: with a plain controlled input, typing "0" would set the
 * value to 0, re-render as empty, and the character the user just typed would
 * vanish. The draft holds exactly what was typed until focus leaves, then the
 * canonical value takes over again. Stepper buttons drop the draft so they
 * never show a stale string.
 */
function useNumericDraft(value: number, onChange: (next: number) => void, parse: (raw: string) => number) {
  const [draft, setDraft] = useState<string | null>(null);

  return {
    display: draft ?? (value === 0 ? '' : String(value)),
    onInput: (raw: string) => {
      setDraft(raw);
      onChange(parse(raw));
    },
    onBlur: () => setDraft(null),
    reset: () => setDraft(null),
  };
}

export function LevelInput({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const clamp = (n: number) => Math.min(Math.max(Math.trunc(n) || 0, 0), max);
  const field = useNumericDraft(value, onChange, (raw) => clamp(Number(raw)));

  const step = (next: number) => {
    field.reset();
    onChange(clamp(next));
  };

  return (
    <span className="level">
      <button
        type="button"
        onClick={() => step(value - 1)}
        disabled={value <= 0}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <input
        type="number"
        // Levels are whole numbers, so the phone keyboard should open without a
        // decimal point on it.
        inputMode="numeric"
        value={field.display}
        placeholder="0"
        min={0}
        max={max}
        aria-label={`${label} level`}
        onChange={(e) => field.onInput(e.target.value)}
        onBlur={field.onBlur}
      />
      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
      <span className="of">/{max}</span>
    </span>
  );
}

/**
 * A checkbox and the words beside it.
 *
 * Pass `label` instead of children where the words already sit elsewhere in the
 * cell — the spells table prints the spell name above its icon — and the box
 * goes out bare but still named to a screen reader.
 */
export function Switch({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        aria-label={children === undefined ? label : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children === undefined ? null : <span>{children}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {hint ? <span className="hint">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  step = 0.01,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  label: string;
}) {
  const field = useNumericDraft(value, onChange, (raw) => {
    const next = Number(raw);
    return Number.isFinite(next) ? next : 0;
  });

  return (
    <input
      className="plain"
      type="number"
      inputMode="decimal"
      step={step}
      value={field.display}
      placeholder="0"
      aria-label={label}
      onChange={(e) => field.onInput(e.target.value)}
      onBlur={field.onBlur}
    />
  );
}

// -------------------------------------------------------------- resources --

/** An amount with the resource's own icon, so a cost column can be scanned. */
export function ResourceAmount({ resource, amount }: { resource: Resource; amount: number }) {
  const src = RESOURCE_ICONS[resource];
  return (
    <span className="res" title={RESOURCE_LABELS[resource]}>
      <span className="num">{formatCost(resource, amount)}</span>
      {src ? (
        <Icon src={src} size={16} alt={RESOURCE_LABELS[resource]} />
      ) : (
        <span className="dot" style={{ ['--dot' as string]: `var(--res-${resource})` }} />
      )}
    </span>
  );
}

/** A cost that may span several resources (the tiered rune unlocks). */
export function BundleAmount({ bundle }: { bundle: ResourceBundle }) {
  const entries = Object.entries(bundle).filter(([, amount]) => (amount ?? 0) > 0) as [
    Resource,
    number,
  ][];

  if (entries.length === 0) return <span className="num">0</span>;

  if (entries.length === 1) {
    const [resource, amount] = entries[0]!;
    return <ResourceAmount resource={resource} amount={amount} />;
  }

  return (
    <span className="res multi">
      {entries.map(([resource, amount]) => (
        <ResourceAmount key={resource} resource={resource} amount={amount} />
      ))}
    </span>
  );
}

/**
 * "next / remaining" for one upgrade row.
 *
 * Two numbers rather than one because they answer different questions: what a
 * player can act on today, and how far the row still has to run. When both are
 * priced in the same single resource — nearly every row — they share one icon
 * and read as a single fraction. The exceptions (Essence Mine, whose tiers step
 * from ash runes to brine) fall back to two full bundles either side of the
 * slash, which is wordier but never wrong.
 */
export function CostPair({ next, remaining }: { next: ResourceBundle; remaining: ResourceBundle }) {
  const nextKeys = Object.keys(next) as Resource[];
  const remainingKeys = Object.keys(remaining) as Resource[];
  const sole =
    nextKeys.length === 1 && remainingKeys.length === 1 && nextKeys[0] === remainingKeys[0]
      ? nextKeys[0]!
      : undefined;

  // Maxed rows have no next level; the em dash says so without implying "free".
  const atMax = nextKeys.length === 0;

  if (sole !== undefined) {
    const src = RESOURCE_ICONS[sole];
    return (
      <span className="res" title={RESOURCE_LABELS[sole]}>
        <span className="num">{formatCost(sole, next[sole] ?? 0)}</span>
        <span className="cost-slash">/</span>
        <span className="num spent">{formatCost(sole, remaining[sole] ?? 0)}</span>
        {src ? (
          <Icon src={src} size={16} alt={RESOURCE_LABELS[sole]} />
        ) : (
          <span className="dot" style={{ ['--dot' as string]: `var(--res-${sole})` }} />
        )}
      </span>
    );
  }

  return (
    <span className="cost-pair">
      {atMax ? <span className="num spent">—</span> : <BundleAmount bundle={next} />}
      <span className="cost-slash">/</span>
      <BundleAmount bundle={remaining} />
    </span>
  );
}

export function ResourceName({ resource }: { resource: Resource }) {
  const src = RESOURCE_ICONS[resource];
  return (
    <span className="res-name">
      {src ? (
        <Icon src={src} size={18} />
      ) : (
        <span className="dot" style={{ ['--dot' as string]: `var(--res-${resource})` }} />
      )}
      {RESOURCE_LABELS[resource]}
    </span>
  );
}

// ------------------------------------------------------------------ misc ---

export function Stat({
  label,
  value,
  help,
}: {
  label: string;
  value: ReactNode;
  help?: HelpId;
}) {
  return (
    <div className="stat">
      <dt>
        {label}
        {help ? <Help id={help} /> : null}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Briefly highlights its content whenever `value` changes. */
export function useFlashOnChange(value: number): boolean {
  const [flash, setFlash] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 60);
    return () => window.clearTimeout(timer);
  }, [value]);

  return flash;
}
