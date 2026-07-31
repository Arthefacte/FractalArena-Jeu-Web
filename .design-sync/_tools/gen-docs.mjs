// Generates <Name>.d.ts, <Name>.jsx (usage), and <Name>.prompt.md per component.
import fs from "node:fs";
import path from "node:path";
import { COMPONENTS } from "./specs.mjs";

const ROOT = path.resolve(process.argv[2] || ".");
const BUNDLE = path.join(ROOT, "ds-bundle");

const REACT = `import type * as React from "react";`;
const BEAST = `import type { Beast } from "../../../_types/beast";`;

const DOCS = {
  Coin: {
    dts: `${REACT}

export interface CoinProps {
  /** Glyph color. Any CSS color or var(). Defaults to var(--gold). */
  c?: string;
}

/** Inline ◎ currency glyph. Place before an amount; tint to encode a currency. */
export declare const Coin: React.FC<CoinProps>;`,
    jsx: `// Coin is an inline glyph — pair it with an amount, size via the parent.
function Wallet({ gold, shards }) {
  return (
    <div className="flex center" style={{ gap: 18, fontSize: 18, fontWeight: 700 }}>
      <span><Coin /> {fmt(gold)}</span>
      <span style={{ color: "var(--elec)" }}><Coin c="var(--elec)" /> {fmt(shards)}</span>
    </div>
  );
}`,
    md: `# Coin

Inline \`◎\` currency glyph. Renders a single \`<span>\` — no layout of its own; it inherits font-size from its parent, so size it by wrapping text.

## Props
- \`c?: string\` — glyph color (CSS color or \`var(--*)\`). Defaults to \`var(--gold)\`.

## Use it for
Currency amounts in HUDs, shop rows, reward toasts. Tint to distinguish currencies — \`var(--gold)\` for soft currency, \`var(--elec)\` for premium, \`var(--alert)\` for a cost the player can't afford.

\`\`\`jsx
<span style={{ fontSize: 18, fontWeight: 700 }}><Coin /> {fmt(12500)}</span>
\`\`\`

Use the bundled \`fmt(n)\` helper for the game's space-grouped number format (\`12 500\`).`,
  },

  Bar: {
    dts: `${REACT}

export interface BarProps {
  /** Fill fraction 0..1 (clamped). */
  frac: number;
  /**
   * Style hook applied as a CSS class on the track. "hp" additionally
   * auto-colors the fill: red < 30%, amber < 60%, else green.
   * Common values: "hp" | "xp".
   */
  kind?: string;
  /** Extra class names on the track. */
  className?: string;
}

/** Thin progress fill. HP kind auto-colors by remaining fraction. */
export declare const Bar: React.FC<BarProps>;`,
    jsx: `// Bar shows progress; add your own label row above it.
function HpRow({ beast }) {
  const cur = D.eff(beast, "hp"), max = D.maxHp(beast);
  return (
    <div>
      <div className="bar-label" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>HP</span><span>{cur}/{max}</span>
      </div>
      <Bar frac={cur / max} kind="hp" />
    </div>
  );
}`,
    md: `# Bar

A thin horizontal progress fill (track + inner fill). No built-in label — compose a label row above it (see \`.bar-label\` in the stylesheet).

## Props
- \`frac: number\` — fill fraction, 0..1 (values outside are clamped).
- \`kind?: string\` — style hook added as a class on the track. \`"hp"\` auto-colors the fill by remaining fraction: **red** under 30%, **amber** under 60%, **green** otherwise. \`"xp"\` is the cyan progress style.
- \`className?: string\` — extra classes on the track.

## Use it for
HP/shield/XP/cast bars. For HP, always pass \`kind="hp"\` so the danger coloring kicks in. Override height inline for compact contexts (\`style={{ height: 6 }}\`).`,
  },

  SectionHead: {
    dts: `${REACT}

export interface SectionHeadProps {
  /** Main heading (rendered in the display .h1 style). */
  title: React.ReactNode;
  /** Small accent label above the title. */
  eyebrow?: React.ReactNode;
  /** Muted mono subtitle below the title. */
  sub?: React.ReactNode;
}

/** Standard screen/section header: eyebrow + title + subtitle. */
export declare const SectionHead: React.FC<SectionHeadProps>;`,
    jsx: `// SectionHead opens a screen or a modal.
function CollectionScreen({ owned }) {
  return (
    <div>
      <SectionHead
        eyebrow="Collection"
        title="Your Beasts"
        sub={\`\${owned.length} owned\`}
      />
      {/* grid of CreatureCard… */}
    </div>
  );
}`,
    md: `# SectionHead

The standard heading block: a cyan **eyebrow**, a large display **title**, and a muted mono **sub**. Use it at the top of every screen and at the top of modals so headings stay consistent.

## Props
- \`title: ReactNode\` — main heading (display font, \`.h1\`).
- \`eyebrow?: ReactNode\` — small accent label above the title.
- \`sub?: ReactNode\` — muted mono subtitle below.

## Use it for
Screen titles, modal headers, section dividers. Keep the eyebrow to 1–2 words (it's uppercased/letter-spaced by the style). Omit \`sub\` for compact headers.`,
  },

  Modal: {
    dts: `${REACT}

export interface ModalProps {
  children?: React.ReactNode;
  /** Close handler. When given, a ✕ button shows and Esc / backdrop-click close. */
  onClose?: () => void;
  /** Wider modal body for dense content. */
  wide?: boolean;
  /** Border accent color (CSS color or var()). */
  accent?: string;
}

/** Centered overlay dialog. Esc and backdrop click call onClose. */
export declare const Modal: React.FC<ModalProps>;`,
    jsx: `// Modal renders a full-screen overlay + centered panel. Mount it conditionally.
function ForgeConfirm({ open, onClose, onForge }) {
  if (!open) return null;
  return (
    <Modal onClose={onClose} accent="var(--forge)">
      <SectionHead eyebrow="Forge" title="Confirm fusion" sub="This action is permanent" />
      <div className="flex" style={{ gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={onForge}>Forge</button>
      </div>
    </Modal>
  );
}`,
    md: `# Modal

A centered overlay dialog: dimmed backdrop + a beveled panel. Mount it conditionally (\`if (!open) return null\`) — it has no open/close state of its own.

## Props
- \`children\` — modal body. Lead with a \`SectionHead\` for the title; end with a right-aligned \`.btn\` row for actions.
- \`onClose?: () => void\` — when provided, a ✕ button appears (top-right) and **Esc** / **backdrop click** call it. Omit for a modal the user can't dismiss casually.
- \`wide?: boolean\` — wider panel for dense content.
- \`accent?: string\` — border accent color; tie it to the action (\`var(--forge)\`, \`var(--alert)\`).

## Use it for
Confirmations, detail views, pickers. Always pair the title with \`SectionHead\` and actions with \`<button className="btn">\` / \`btn ghost\`.`,
  },

  StatGrid: {
    dts: `${REACT}
${BEAST}

export interface StatGridProps {
  beast: Beast;
  /** Drop the HP cell, show ATK/DEF/SPD/MAG only. */
  compact?: boolean;
}

/** Five-cell stat row (HP/ATK/DEF/SPD/MAG), values derived via FA_DATA.eff. */
export declare const StatGrid: React.FC<StatGridProps>;`,
    jsx: `// StatGrid reads a Beast and derives effective stats itself.
function CardStats({ beast }) {
  return <StatGrid beast={beast} />;       // full
}
function CompactStats({ beast }) {
  return <StatGrid beast={beast} compact />; // ATK/DEF/SPD/MAG
}`,
    md: `# StatGrid

A row of stat cells — **HP, ATK, DEF, SPD, MAG** — each a label + value. Values are computed from the beast with \`FA_DATA.eff(beast, key)\` (base × level multiplier), so you pass the \`Beast\`, not numbers. HP renders in success-green.

## Props
- \`beast: Beast\` — the creature (see \`_types/beast\`; ready instances on \`FractalArenaDS.sample\`).
- \`compact?: boolean\` — drop the HP cell (ATK/DEF/SPD/MAG only), e.g. inside a card.

## Use it for
Stat readouts on cards and detail panels. For an animated/bar-style readout use \`MiniStats\` instead.`,
  },

  MiniStats: {
    dts: `${REACT}
${BEAST}

export interface MiniStatsProps {
  beast: Beast;
}

/** Inline stat bars (label · bar · value) for HP/ATK/DEF/SPD/MAG. */
export declare const MiniStats: React.FC<MiniStatsProps>;`,
    jsx: `// MiniStats: compact bar readout, e.g. a forge/fusion preview.
function ForgePreview({ result }) {
  return (
    <div style={{ width: 280 }}>
      <div className="eyebrow">Result</div>
      <MiniStats beast={result} />
    </div>
  );
}`,
    md: `# MiniStats

A compact, bar-based stat readout: one row per stat (HP/ATK/DEF/SPD/MAG) as **label · electric-cyan bar · value**. Bars are scaled for at-a-glance comparison. Like \`StatGrid\`, it derives values from the beast via \`FA_DATA.eff\`.

## Props
- \`beast: Beast\` — the creature.

## Use it for
Side-by-side comparisons and forge/fusion previews where the visual bar matters more than the grid. Constrain its width with a wrapper (\`style={{ width: 280 }}\`). For a numeric card readout use \`StatGrid\`.`,
  },

  CreatureCard: {
    dts: `${REACT}
${BEAST}

export interface CreatureCardProps {
  beast: Beast;
  /** Selected state — highlights with the rarity color border. */
  selected?: boolean;
  /** Make the card a selectable tile (adds hover + a check affordance). */
  selectable?: boolean;
  /** Show the XP progress bar in the card body. */
  showXp?: boolean;
  /** Click handler for the whole card. */
  onClick?: (e: React.MouseEvent) => void;
  /** Extra node rendered over the art (e.g. a "NEW" / count badge). */
  badge?: React.ReactNode;
}

/** Collection/selection card: art, rarity + level tags, name, preset, stats. */
export declare const CreatureCard: React.FC<CreatureCardProps>;`,
    jsx: `// CreatureCard in a selectable collection grid.
function Collection({ beasts, selectedId, onPick }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
      {beasts.map((b) => (
        <CreatureCard
          key={b.id}
          beast={b}
          selectable
          selected={b.id === selectedId}
          showXp
          onClick={() => onPick(b.id)}
        />
      ))}
    </div>
  );
}`,
    md: `# CreatureCard

The collection/selection card: creature art, **rarity tag** + **level tag** over the art, name, preset label, and an embedded \`StatGrid\`. The rarity drives the card's border color (via a \`--rc\` custom property), so Legendary/Epic/Rare/Common cards read at a glance.

## Props
- \`beast: Beast\` — the creature (art comes from \`beast.image_key\`; ready instances on \`FractalArenaDS.sample\`).
- \`selectable?: boolean\` — render as a pickable tile (hover + check affordance).
- \`selected?: boolean\` — highlighted/selected state (rarity-colored border + ✓).
- \`showXp?: boolean\` — add the XP progress bar to the body.
- \`onClick?: (e) => void\` — click handler for the whole card.
- \`badge?: ReactNode\` — node layered over the art (a "NEW" flag, owned count, etc.).

## Use it for
Collection grids, team/roster pickers, reward reveals. In a picker, set \`selectable\` on every card and \`selected\` on the active one; size cards ~200–240px wide. Use \`showXp\` where progression matters (collection), drop it in tight pickers.`,
  },
};

for (const c of COMPONENTS) {
  const dir = path.join(BUNDLE, "components", c.group, c.name);
  fs.mkdirSync(dir, { recursive: true });
  const d = DOCS[c.name];
  if (!d) throw new Error("no docs for " + c.name);
  fs.writeFileSync(path.join(dir, `${c.name}.d.ts`), d.dts.trimStart() + "\n");
  fs.writeFileSync(path.join(dir, `${c.name}.jsx`), d.jsx.trimStart() + "\n");
  fs.writeFileSync(path.join(dir, `${c.name}.prompt.md`), d.md.trimStart() + "\n");
  console.log("docs", `${c.group}/${c.name}`);
}
console.log("done docs:", COMPONENTS.length);
