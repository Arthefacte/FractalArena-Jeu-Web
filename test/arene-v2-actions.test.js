// Arène V2 : exécute les actions isolées avec réponses en mémoire, sans réseau.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.jsx'), 'utf8');

function action(name, responses) {
  const start = source.indexOf(`    async ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n    },', start) + '\n    }'.length;
  const calls = [], saves = [], changes = [];
  const state = { wallet: 'mine', authToken: 'session', liquid: 700, pvp: { fa_cost: 17 } };
  const context = {
    API_URL: 'https://offline.invalid',
    gRef: { current: state },
    svOpts: () => ({ headers: { Authorization: 'Bearer session' } }),
    applySave: (...args) => saves.push(args),
    setG: (fn) => changes.push(fn(state)),
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      assert.ok(responses.length, 'aucun appel supplémentaire attendu');
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body };
    },
  };
  const fn = vm.runInNewContext(`({${source.slice(start, end)}}).${name}`, context);
  return { fn, calls, saves, changes };
}

test('défense : Bearer, HP et posture cachée préservés, sans posture inventée', async () => {
  const a = action('pvpDefenseOf', [{ status: 200, body: { ok: true, wallet: 'mine', team: [], hp_left: 0, hp_max: 900, down_until: null, posture_hidden: true, stale: true } }]);
  const result = await a.fn('j-player');
  assert.equal(a.calls[0].opts.headers.Authorization, 'Bearer session');
  assert.equal(result.hp_left, 0);
  assert.equal(result.hp_max, 900);
  assert.equal(result.down_until, null);
  assert.equal(result.stale, true);
  assert.equal(result.posture, null);
  assert.equal(result.hidden, true);
});

test('défense : provenance facultative transmise sans inventer les champs absents', async () => {
  const provenance = { posted_at: '2026-10-17T12:00:00.000Z', power: 100, best_power: 126 };
  for (const fields of [{}, provenance]) {
    const a = action('pvpDefenseOf', [{ status: 200, body: { ok: true, team: [], ...fields } }]);
    const result = await a.fn('mine');
    for (const key of Object.keys(provenance)) {
      assert.equal(result[key], fields[key]);
      assert.equal(Object.hasOwn(result, key), Object.hasOwn(fields, key));
    }
  }
});

test('défense : 404 pas_de_fantome distingué des erreurs réseau/serveur', async () => {
  for (const failure of [{ status: 404, body: { error: 'pas_de_fantome' } }, { status: 503, body: {} }, new Error('offline')]) {
    const result = await action('pvpDefenseOf', [failure]).fn('mine');
    assert.equal(result.ok, false);
    assert.equal(result.error, failure instanceof Error ? 'network' : failure.status === 404 ? 'pas_de_fantome' : 'server');
    assert.equal(result.status, failure.status);
  }
});

test('soin : PV réponse et solde /save font foi, sans soustraction locale', async () => {
  const a = action('pvpHeal', [
    { status: 200, body: { ok: true, hp_left: 900, hp_max: 900, cost: 23 } },
    { status: 200, body: { save: { arte_liquid: 691 } } },
  ]);
  const result = await a.fn();
  assert.equal(result.hp_left, 900);
  assert.equal(a.calls[0].url, 'https://offline.invalid/pvp/heal');
  assert.equal(a.calls[0].opts.method, 'POST');
  assert.equal(a.calls[0].opts.headers.Authorization, 'Bearer session');
  assert.equal(a.calls[1].url, 'https://offline.invalid/save/mine');
  assert.equal(a.saves[0][0].arte_liquid, 691);
  assert.equal(a.saves[0][1], 'mine');
  assert.equal(a.changes.length, 0);
});

test('soin refusé : les quatre codes restent lisibles par i18n, sans resync ni débit', async () => {
  for (const [status, error] of [[403, 'pas_de_defense'], [409, 'defense_tombee'], [400, 'defense_pleine'], [400, 'solde_insuffisant']]) {
    const a = action('pvpHeal', [{ status, body: { error } }]);
    assert.equal((await a.fn()).error, error);
    assert.equal(a.calls.length, 1);
    assert.equal(a.saves.length, 0);
    assert.equal(a.changes.length, 0);
  }
});

test('soin confirmé reste réussi si la relecture du solde échoue', async () => {
  const a = action('pvpHeal', [{ status: 200, body: { ok: true, hp_left: 900, hp_max: 900, cost: 23 } }, new Error('offline')]);
  assert.equal((await a.fn()).ok, true);
  assert.equal(a.changes.length, 0);
});

test('attaque : préserve plafond_couple en 429 et les autres refus V2', async () => {
  for (const [status, error] of [[429, 'plafond_couple'], [403, 'pas_de_defense'], [409, 'defense_tombee'], [404, 'cible_sans_fantome'], [429, undefined]]) {
    const a = action('pvpAttack', [{ status, body: { error } }]);
    const result = await a.fn('j-target', 'free', ['a', 'b', 'c'], 'equilibre');
    assert.equal(result.ok, false);
    assert.equal(result.error, error || 'rate_limited');
    assert.equal(JSON.parse(a.calls[0].opts.body).target, 'j-target');
    assert.equal(a.changes.length, 0);
  }
});
