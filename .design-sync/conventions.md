# Fractal Arena — building with this design system

A dark, neon, crypto-arena game UI. Build screens by composing the library
components below for the real parts, and styling your own layout glue with this
system's **utility classes** and **CSS custom-property tokens**. Don't invent a
new visual language — every color, font, and surface already has a token or class.

## Setup

- Components are exposed on the global **`FractalArenaDS`** (React is a global too):

  ```jsx
  const { CreatureCard, Modal, SectionHead, Bar, Coin, StatGrid, MiniStats } = FractalArenaDS;
  ```

- **`styles.css` must be loaded** — it carries the tokens, the component classes,
  and the Google-Fonts `@import` (Chakra Petch + JetBrains Mono). Without it,
  components render unstyled.
- **No provider is required.** The data-driven components read game data from a
  bundled runtime; they render correctly on their own. There is an optional
  `FractalArenaDS.FA_Ctx` / `useFA()` for app state, but it is not needed to render.
- **Data-driven components take a `Beast` object** (`StatGrid`, `CreatureCard`,
  `MiniStats`). Ready-made instances are on **`FractalArenaDS.sample`**
  (`.legendary`, `.epic`, `.rare`, `.common`) — use them directly, or shape your
  own per `_types/beast.d.ts`. Helpers live on **`FractalArenaDS.data`**
  (`eff`, `maxHp`, `displayName`, `xpToNext`, `ART`) and `FractalArenaDS.fmt`
  (space-grouped numbers), `FractalArenaDS.cx` (class joiner).

## Styling idiom — utility classes + `var(--*)` tokens

Style your own layout glue with these classes (don't write new class names; use
these plus inline `style` with the tokens):

| Family | Classes |
|---|---|
| Layout | `flex`, `center`, `between`, `wrap`, `container`, `divider`, `gap8` |
| Surfaces | `panel`, `card`, `chip`, `pill`, `field`, `framed`, `modal`, `overlay` |
| Type | `h1`, `h2`, `eyebrow`, `muted`, `mono` |
| Stats | `stat`, `stat-row`, `bar`, `bar-label` |
| Buttons | `btn` + modifiers `ghost` `solid` `sm` `lg` `block` `on`, and color variants `btn-fire` `btn-elec` `btn-forge` `btn-success` `btn-alert` `btn-gold` |

Tokens (use as `var(--name)` in inline styles):

| Family | Tokens |
|---|---|
| Backgrounds | `--bg-0` `--bg-1` `--bg-panel` `--bg-panel-2` `--bg-elev` |
| Text | `--text` `--text-dim` `--text-faint` |
| Accents | `--fire` `--elec` `--forge` `--success` `--alert` `--gold` |
| Rarities | `--r-common` `--r-rare` `--r-epic` `--r-legendary` |
| Lines / shape | `--line` `--line-soft` `--bevel` `--bevel-sm` |
| Fonts | `--font-display` (Chakra Petch) `--font-mono` (JetBrains Mono) |

Default page: dark background (`var(--bg-0)`), text `var(--text)`, display font.
Accent meaning: `--elec` = primary/active, `--forge` = fuse/upgrade,
`--alert` = danger/cost, `--gold` = currency, `--success` = HP/gain.

## Where the real truth lives

Read these before styling — they beat any summary:
- `styles.css` (and its `@import`) — every class and token, authoritative.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage + props.
- `components/<group>/<Name>/<Name>.d.ts` and `_types/beast.d.ts` — the API contract.

## One idiomatic build snippet

```jsx
const { SectionHead, CreatureCard, Coin, fmt, sample } = FractalArenaDS;

function CollectionScreen({ beasts = [sample.legendary, sample.epic, sample.rare] }) {
  return (
    <div className="container" style={{ background: "var(--bg-0)", color: "var(--text)", padding: 24 }}>
      <div className="flex between center">
        <SectionHead eyebrow="Collection" title="Your Beasts" sub={`${beasts.length} owned`} />
        <span style={{ fontWeight: 700 }}><Coin /> {fmt(12500)}</span>
      </div>
      <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
        {beasts.map((b) => <CreatureCard key={b.id} beast={b} selectable showXp />)}
      </div>
    </div>
  );
}
```
