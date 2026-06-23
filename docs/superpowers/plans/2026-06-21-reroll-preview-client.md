# Reroll aperçu + validation — Plan client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Côté client, brancher le flux reroll en deux temps : reroll → **modale comparatif** (Actuel → Proposé) → **Valider / Re-roll / Garder les anciennes**.

**Architecture :** L'action `reroll` ne ré-applique plus — elle renvoie l'aperçu (`old_stats`/`new_stats`/`cost`/`next_reroll_cost`). Deux nouvelles actions `rerollConfirm`/`rerollDiscard`. Le composant `ForgeReroll` ouvre une modale comparatif. Helper pur `rerollDiff` testé.

**Tech Stack :** React via Babel standalone, `node:test` (helpers purs), i18n FR/EN/ZH.

## Global Constraints

- Worktree `C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\fractal-arena-web-reroll` (branche `feat/reroll-preview-ui`, depuis `origin/main` web `564fdb7`).
- **Aucune référence Totem.**
- Contrat serveur (déjà codé) :
  - `POST /forge/reroll {wallet, beast_id}` → `{ status:"ok", pending:true, cost, next_reroll_cost, old_stats:{base_hp,base_atk,base_def,base_spd,base_mag}, new_stats:{...} }` ou `{ status:"insufficient_balance" }`. **N'applique pas** (débite le coût plein).
  - `POST /forge/reroll/confirm {wallet, beast_id}` → `{ status:"ok", result_beast }`.
  - `POST /forge/reroll/discard {wallet, beast_id}` → `{ status:"ok", refunded }`.
- Après chaque action, **resynchroniser** l'état via `GET /save/:wallet` → `serverToState` (le solde a bougé).
- Node v24 : tests par fichiers explicites. `npm install` requis dans le worktree pour le check Babel.

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `app.jsx` | Actions | `reroll` modifiée (renvoie l'aperçu) + `rerollConfirm` + `rerollDiscard` |
| `forge-ui.js` | Helper pur `rerollDiff` (Node-testable) | Créer + exposer `window.FA_FORGE_UI` |
| `screens.jsx` | `ForgeReroll` + `RerollPreviewModal` | Modifier + ajouter la modale |
| `i18n.js` | Libellés `REROLL_*` | Ajouter (FR/EN/ZH) |
| `index.html` | Charger `forge-ui.js` + cache-bust | Ajouter le `<script>` + bump `?v=33`→`?v=34` |
| `test/forge-ui.test.js` | Test de `rerollDiff` | Créer |

---

### Task 1 : Helper pur `rerollDiff` + test

**Files:** Create `forge-ui.js`, `test/forge-ui.test.js`

**Interfaces — Produces :** `window.FA_FORGE_UI.rerollDiff(oldStats, newStats)` → tableau de 5 lignes `{ key, label, from, to, dir }` (`dir` = `"up"|"down"|"same"`), ordre HP/ATK/DEF/SPD/MAG.

- [ ] **Step 1 : Test** — `test/forge-ui.test.js` :
```js
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-ui.js");
const F = globalThis.window.FA_FORGE_UI;

test("rerollDiff : 5 lignes ordonnées, direction correcte", () => {
  const rows = F.rerollDiff(
    { base_hp: 100, base_atk: 20, base_def: 10, base_spd: 12, base_mag: 8 },
    { base_hp: 90,  base_atk: 30, base_def: 10, base_spd: 14, base_mag: 6 }
  );
  assert.strictEqual(rows.length, 5);
  assert.deepStrictEqual(rows.map((r) => r.key), ["base_hp", "base_atk", "base_def", "base_spd", "base_mag"]);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.strictEqual(byKey.base_hp.dir, "down");
  assert.strictEqual(byKey.base_atk.dir, "up");
  assert.strictEqual(byKey.base_def.dir, "same");
  assert.strictEqual(byKey.base_atk.from, 20);
  assert.strictEqual(byKey.base_atk.to, 30);
});

test("rerollDiff : tolère stats manquantes (→ 0)", () => {
  const rows = F.rerollDiff({}, { base_hp: 5 });
  assert.strictEqual(rows.find((r) => r.key === "base_hp").to, 5);
  assert.strictEqual(rows.find((r) => r.key === "base_hp").from, 0);
});
```

- [ ] **Step 2 : Lancer, échec** — `node --test test/forge-ui.test.js` → FAIL.

- [ ] **Step 3 : Créer `forge-ui.js`** :
```js
/* FRACTAL ARENA — Forge : helpers purs (testables Node) */
(function () {
  const KEYS = [
    { key: "base_hp",  label: "HP" },
    { key: "base_atk", label: "ATK" },
    { key: "base_def", label: "DEF" },
    { key: "base_spd", label: "SPD" },
    { key: "base_mag", label: "MAG" },
  ];
  function rerollDiff(oldStats, newStats) {
    const o = oldStats || {}, n = newStats || {};
    return KEYS.map(({ key, label }) => {
      const from = Number(o[key]) || 0;
      const to = Number(n[key]) || 0;
      const dir = to > from ? "up" : to < from ? "down" : "same";
      return { key, label, from, to, dir };
    });
  }
  window.FA_FORGE_UI = { rerollDiff };
})();
```

- [ ] **Step 4 : Relancer** → PASS.

- [ ] **Step 5 : Commit** — `git add forge-ui.js test/forge-ui.test.js && git commit -m "feat(forge): helper pur rerollDiff (comparatif stats)"`

---

### Task 2 : Actions `reroll` (aperçu) + `rerollConfirm` + `rerollDiscard`

**Files:** Modify `app.jsx` (remplacer l'action `reroll`, ~lignes 595-614 ; ajouter les deux nouvelles juste après)

**Interfaces — Produces :**
- `reroll(id)` → `{ ok:true, preview:{ old_stats, new_stats, cost, next_reroll_cost } }` ou `{ ok:false, reason }`. Resynchronise le solde, n'applique pas.
- `rerollConfirm(id)` → `{ ok:true }` ou `{ ok:false, reason }`. Resync.
- `rerollDiscard(id)` → `{ ok:true, refunded }` ou `{ ok:false, reason }`. Resync.

- [ ] **Step 1 : Remplacer l'action `reroll`** par :
```js
    async reroll(id) {
      const s = gRef.current;
      const beast = s.roster.find((b) => b.id === id);
      if (!beast) return { ok: false, reason: I18N.t("FG_PICK1") };
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, data.cost || 0) };
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        // Mode pending : rien n'est appliqué ; on resynchronise le solde (débité) et on renvoie l'aperçu.
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, preview: { old_stats: data.old_stats, new_stats: data.new_stats, cost: data.cost, next_reroll_cost: data.next_reroll_cost } };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },
    async rerollConfirm(id) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll/confirm`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },
    async rerollDiscard(id) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll/discard`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, refunded: data.refunded };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },
```

- [ ] **Step 2 : Parse** — vérifier que `app.jsx` parse (Babel). Commande en Task 4 Step après modale ; ici juste `npx babel app.jsx > $null` ou via le check global.

- [ ] **Step 3 : Commit** — `git add app.jsx && git commit -m "feat(forge): actions reroll(apercu)/rerollConfirm/rerollDiscard"`

---

### Task 3 : `RerollPreviewModal` + `ForgeReroll` câblé + i18n

**Files:** Modify `screens.jsx` (composant `ForgeReroll` ~ligne 130 ; ajouter `RerollPreviewModal`), `i18n.js`

**Interfaces — Consumes :** `window.FA_FORGE_UI.rerollDiff`, `window.Modal`, actions `reroll/rerollConfirm/rerollDiscard`.

- [ ] **Step 1 : Ajouter les clés i18n** dans `i18n.js` (près des `FG_*`) :
```js
    REROLL_PREVIEW_TITLE: { FR: "Nouvelle répartition", EN: "New distribution", ZH: "新的分配" },
    REROLL_CURRENT:  { FR: "Actuel", EN: "Current", ZH: "当前" },
    REROLL_PROPOSED: { FR: "Proposé", EN: "Proposed", ZH: "提议" },
    REROLL_VALIDATE: { FR: "Valider", EN: "Keep this", ZH: "确认" },
    REROLL_AGAIN:    { FR: "Re-roll (%d)", EN: "Re-roll (%d)", ZH: "重抽 (%d)" },
    REROLL_KEEP_OLD: { FR: "Garder les anciennes", EN: "Keep old stats", ZH: "保留原属性" },
    REROLL_REFUND_HINT: { FR: "Budget total identique. Si tu gardes les anciennes, 50 % du coût t'est remboursé.", EN: "Same total budget. Keep the old ones and 50% of the cost is refunded.", ZH: "总预算不变。保留原属性可退还 50% 费用。" },
    REROLL_KEPT_OLD: { FR: "Anciennes stats gardées — %d FA remboursés", EN: "Old stats kept — %d FA refunded", ZH: "保留原属性 — 退还 %d FA" },
```

- [ ] **Step 2 : Ajouter `RerollPreviewModal`** dans `screens.jsx` (au-dessus de `ForgeReroll`) :
```js
function RerollPreviewModal({ preview, busy, onValidate, onAgain, onKeep }) {
  const { Modal } = window;
  const F = window.FA_FORGE_UI;
  const rows = F.rerollDiff(preview.old_stats, preview.new_stats);
  const color = (dir) => dir === "up" ? "var(--success)" : dir === "down" ? "var(--alert)" : "var(--text-dim)";
  const arrow = (dir) => dir === "up" ? "▲" : dir === "down" ? "▼" : "=";
  return (
    <Modal onClose={onKeep} accent="var(--elec)">
      <div className="h1" style={{ fontSize: 24, color: "var(--elec)", textAlign: "center", marginBottom: 14 }}>{I18N.t("REROLL_PREVIEW_TITLE")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 14px", alignItems: "center", marginBottom: 12 }}>
        <span className="mono muted" style={{ fontSize: 11 }}></span>
        <span className="mono muted" style={{ fontSize: 11, textAlign: "right" }}>{I18N.t("REROLL_CURRENT")}</span>
        <span className="mono muted" style={{ fontSize: 11, textAlign: "right" }}>{I18N.t("REROLL_PROPOSED")}</span>
        {rows.map((r) => [
          <span key={r.key + "l"} className="mono" style={{ fontSize: 13 }}>{r.label}</span>,
          <span key={r.key + "f"} className="mono" style={{ fontSize: 13, textAlign: "right", color: "var(--text-dim)" }}>{r.from}</span>,
          <span key={r.key + "t"} className="mono" style={{ fontSize: 13, textAlign: "right", color: color(r.dir) }}>{r.to} {arrow(r.dir)}</span>,
        ])}
      </div>
      <div className="mono muted" style={{ fontSize: 11, marginBottom: 14 }}>{I18N.t("REROLL_REFUND_HINT")}</div>
      <div className="flex gap8" style={{ flexWrap: "wrap" }}>
        <button className="btn btn-success" disabled={busy} onClick={onValidate}>{I18N.t("REROLL_VALIDATE")}</button>
        <button className="btn btn-elec" disabled={busy} onClick={onAgain}>{I18N.t("REROLL_AGAIN", preview.next_reroll_cost || 0)}</button>
        <button className="btn" disabled={busy} onClick={onKeep}>{I18N.t("REROLL_KEEP_OLD")}</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3 : Câbler `ForgeReroll`** — remplacer la fonction `doReroll` et son état pour gérer l'aperçu :
```js
function ForgeReroll() {
  const { g, actions, toast } = useFA();
  const [sel, setSel] = useState(null);
  const [rerollBusy, setRerollBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const beast = sel ? g.roster.find((b) => b.id === sel) : null;
  const cost = beast ? Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count)) : 0;
  const balOk = (g.liquid + g.locked) >= cost;
  async function doReroll() {
    if (rerollBusy) return;
    setRerollBusy(true);
    const r = await actions.reroll(sel);
    setRerollBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    setPreview(r.preview);
  }
  async function onValidate() {
    setRerollBusy(true);
    const r = await actions.rerollConfirm(sel);
    setRerollBusy(false);
    setPreview(null);
    if (r.ok) toast(I18N.t("FG_REROLL_OK"), "good"); else toast(r.reason, "bad");
  }
  async function onAgain() {
    setRerollBusy(true);
    const r = await actions.reroll(sel);
    setRerollBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); setPreview(null); return; }
    setPreview(r.preview);
  }
  async function onKeep() {
    setRerollBusy(true);
    const r = await actions.rerollDiscard(sel);
    setRerollBusy(false);
    setPreview(null);
    if (r.ok) toast(I18N.t("REROLL_KEPT_OLD", r.refunded || 0), "good"); else toast(r.reason, "bad");
  }
  return (
    <div>
      <div className="flex between center wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div className="mono muted" style={{ fontSize: 13 }}>{I18N.t("FG_REROLL_HINT")}</div>
        {beast && (
          <div className="flex gap12 center">
            <span className="pill">reroll #{beast.reroll_count + 1}</span>
            <button className="btn btn-elec" disabled={!balOk || rerollBusy} onClick={doReroll}>{rerollBusy ? "…" : I18N.t("FG_REROLL_BTN", cost)}</button>
          </div>
        )}
      </div>
      {!balOk && beast && <div className="mono" style={{ color: "var(--alert)", fontSize: 12, marginBottom: 10 }}>{I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)}</div>}
      <div className="grid-cards">
        {g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]).map((b) => (
          <CreatureCard key={b.id} beast={b} selectable selected={sel === b.id} onClick={() => setSel(sel === b.id ? null : b.id)} />
        ))}
      </div>
      {preview && <RerollPreviewModal preview={preview} busy={rerollBusy} onValidate={onValidate} onAgain={onAgain} onKeep={onKeep} />}
    </div>
  );
}
```

- [ ] **Step 4 : Charger `forge-ui.js` + cache-bust** dans `index.html` : ajouter `<script src="forge-ui.js?v=34"></script>` près de `arene-ui.js`, et remplacer **toutes** les occurrences `?v=33` → `?v=34`.

- [ ] **Step 5 : Vérifs** — `npm install` (si pas fait) ; parse Babel de `app.jsx` + `screens.jsx` (via `@babel/core` preset `@babel/preset-react`) → OK ; `node --test test/forge-ui.test.js` → PASS ; `grep -i totem` sur les fichiers modifiés → vide.

- [ ] **Step 6 : Commit** — `git add screens.jsx i18n.js index.html && git commit -m "feat(forge): modale comparatif reroll (valider/re-roll/garder) + i18n + cache-bust v34"`

---

## Self-Review

- **Couverture spec :** aperçu sans application (reroll renvoie preview, T2) ; 3 actions (T2) ; modale comparatif coloré + 3 boutons + hint remboursement (T3) ; helper diff testé (T1) ; cache-bust (T3). ✔
- **Placeholder scan :** code exact fourni. ✔
- **Cohérence types :** `preview = { old_stats, new_stats, cost, next_reroll_cost }` cohérent entre l'action `reroll` (T2) et la modale (T3) ; `rerollDiff` rows `{key,label,from,to,dir}` cohérents T1↔T3. ✔
- **Risque :** la modale appelle `onKeep` à la fermeture (`onClose`) → garder-les-anciennes = discard (rembourse 50 %), cohérent avec « fermer = garder l'ancienne ». ✔
