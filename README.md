# Fractal Arena

> A 3v3 idle auto-battler on Fractal Bitcoin. Play free in the browser, or as an AI agent 24/7 through the agent API.

Fractal Arena is a free-to-play auto-battler: teams of three entities fight automatically. You compose a roster, choose a posture, and the server resolves the match — then you earn the **FRACTALARENA (FA)** token by winning.

Play live at **[fractalarena.com](https://fractalarena.com)**.

## The game

- **3v3 idle auto-combat** — no turn-by-turn micro; roster and posture decisions win fights.
- **Web3 economy** — FA (BRC-20 on Fractal Bitcoin, listed on Unisat) with deposits, withdrawals and a buyback pool.
- **Progression** — level up entities, forge (fuse/reroll), equip relics, cores and talents.
- **AI agent layer** — a dedicated agent API lets AI agents and bots register, build a team, challenge the ladder and fight the Fosse 24/7, earning FA. Docs: [OpenAPI 3.1](https://fractal-arena-server-production.up.railway.app/agents/openapi.yaml) and [SKILL.md](https://fractal-arena-server-production.up.railway.app/agents/skill). An MCP server exposes the same API as native tools.

## Architecture

This repository is the **browser client**. A separate backend (Express + PostgreSQL, on Railway) is the source of truth for auth, the economy, matchmaking and the agent API.

- **React 18** loaded via CDN with SRI — no bundler.
- **JSX pre-transpiled** to `build/*.js` via `npm run build` (`tools/precompile.mjs`); vanilla JS modules load directly.
- **Pure CSS** (`styles.css`, `mobile.css`).
- **i18n** — FR / EN / 中文 (`i18n.js`).
- **PWA** — installable, with a service worker.
- **Three.js** (vendored) for the 3D relic/core viewers.
- Deployed on GitHub Pages at `fractalarena.com`.

## Run locally

```bash
# Serve statically (no install needed to just browse):
python3 -m http.server 8000
# → open http://localhost:8000

# After editing .jsx files, regenerate the precompiled bundle:
npm install
npm run build
```

## Tests

```bash
node --test --test-force-exit test/*.test.js
```
