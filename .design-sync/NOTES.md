# Design Sync — Notes (off-script)

`fractal-arena-web` is an **in-browser Babel** app, outside the converter's envelope:
- React/ReactDOM loaded as UMD globals from unpkg.
- Components are `text/babel` global functions in `components.jsx`, sharing scope with
  `data.js` (`window.FA_DATA`), `i18n.js` (`window.FA_I18N`), `cosmetic.js`, etc.
- No bundler, no `dist/`, no Storybook, no npm package.

## Build approach
- Compile `components.jsx` (verbatim source) with esbuild into an IIFE that assigns the
  components onto a global `window.FractalArenaDS`.
- Runtime dependencies provided as **shims** so components render standalone:
  - `FA_DATA` — minimal mirror of `data.js` (colors, ART map, `eff`, `xpToNext`,
    `displayName`) + a sample `beast` object.
  - `FA_I18N` — minimal `t()` passthrough.
- `styles.css` is the customer's real stylesheet (tokens + component classes), unchanged.
  Fonts: Google Fonts `@import` already at top of styles.css (Chakra Petch, JetBrains Mono).
- Creature art (`assets/*.PNG`) vendored so `CreatureCard` renders real images.

## Component inventory (components.jsx)
- Pure/presentational: `Coin`, `Bar`, `Modal`, `SectionHead`
- Data-driven (need a `beast`): `StatGrid`, `CreatureCard`, `MiniStats`

## Verification
- Off-script: render each component in a local harness HTML and grade on the absolute rubric
  (the storybook screenshot-pair path does not apply — no stories).
- Screenshots via headless Edge (`msedge.exe --headless=new --screenshot`), Chrome absent.

## Off-script toolchain (.design-sync/_tools/)
- `build.mjs`  — concat shim + components.jsx (verbatim) → esbuild IIFE → `ds-bundle/_ds_bundle.js`.
- `specs.mjs`  — component list, groups, preview render snippets, viewports (single source of truth).
- `gen-cards.mjs` — writes `components/<group>/<Name>/<Name>.html` (@dsCard first line).
- `gen-docs.mjs`  — writes `.d.ts` / `.jsx` / `.prompt.md` per component.
- `gen-readme.mjs`— conventions.md + component index → `ds-bundle/README.md`.
- `_tools/node_modules` holds sharp (thumbnails) + esbuild. Excluded from upload.
- Rebuild-all: build.mjs → gen-cards.mjs → gen-docs.mjs → gen-readme.mjs, then re-screenshot.

## _ds_sync.json (sync anchor)
- NOT uploaded. The remote anchor schema is the converter's; a hand-rolled one could confuse
  the app. Per the skill, omitting it is the honest off-script choice — next sync re-verifies
  everything (which is correct). `noRemoteAnchor: true` in config records this.

## Decisions
- Source DS = fractal-arena-web (user choice; 7 web variants share ~same components.jsx).
- Global name = FractalArenaDS. React vendored as UMD prod in _vendor/.
- Fonts: kept Google-Fonts @import at top of styles.css (their real setup; renders fine).
- Creature art embedded as 300px PNG data-URIs in the bundle (full PNGs are ~2MB each).
