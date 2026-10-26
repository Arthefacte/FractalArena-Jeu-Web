// LOT 3c : actions locales de formation exécutées sans monter l'application ni faire de réseau.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.jsx'), 'utf8');
const localWindow = {};
for (const file of ['expeditions-ui.js', 'arene-ui.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { window: localWindow });
}

function action(name, initial, extras = {}) {
  const start = source.indexOf(`    ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n    },', start) + '\n    }'.length;
  let state = initial;
  const context = {
    ...extras,
    setG: (update) => { state = update(state); },
    fetch: () => assert.fail('la sélection ne doit pas effectuer de requête'),
  };
  const fn = vm.runInNewContext(`({${source.slice(start, end)}}).${name}`, context);
  return { fn, state: () => state };
}

function initialState(selected = ['a', 'b', 'c']) {
  return Object.freeze({
    selected: Object.freeze(selected),
    roster: Object.freeze(['a', 'b', 'c', 'd'].map((id) => Object.freeze({ id }))),
    pvp: Object.freeze({ defense: ['posted-a', 'posted-b', 'posted-c'], posted_at: '2026-10-17' }),
    liquid: 700,
    view: 'arene',
  });
}

test('replaceSelected : chaque position est remplacée sans changer les deux autres', () => {
  for (const index of [0, 1, 2]) {
    const initial = initialState();
    const a = action('replaceSelected', initial);
    a.fn(index, 'd');
    const expected = ['a', 'b', 'c'];
    expected[index] = 'd';
    assert.deepEqual(Array.from(a.state().selected), expected);
    assert.deepEqual(initial.selected, ['a', 'b', 'c'], 'aucune mutation de la sélection précédente');
    for (const key of Object.keys(initial).filter((key) => key !== 'selected')) {
      assert.equal(a.state()[key], initial[key], `${key} doit rester inchangé`);
    }
  }
});

test('replaceSelected : une entité déjà sélectionnée est refusée sans changer l’état', () => {
  for (const id of ['a', 'b', 'c']) {
    const initial = initialState();
    const a = action('replaceSelected', initial);
    a.fn(1, id);
    assert.equal(a.state(), initial);
  }
});

test('replaceSelected : les index hors bornes, fractionnaires et non numériques sont refusés', () => {
  for (const index of [-1, 3, 100, 0.5, NaN, Infinity, '1', null, undefined]) {
    const initial = initialState();
    const a = action('replaceSelected', initial);
    a.fn(index, 'd');
    assert.equal(a.state(), initial, String(index));
  }
});

test('replaceSelected : un emplacement absent ne crée ni trou ni nouvelle sélection', () => {
  for (const selected of [[], ['a'], ['a', 'b']]) {
    const initial = initialState(selected);
    const a = action('replaceSelected', initial);
    a.fn(selected.length, 'd');
    assert.equal(a.state(), initial);
  }
});

test('replaceSelected : une entité absente ou consommée est refusée', () => {
  const initial = initialState();
  const a = action('replaceSelected', initial);
  for (const id of ['unknown', 'fused-away', null, undefined]) {
    a.fn(0, id);
    assert.equal(a.state(), initial);
  }
});

test('replaceSelected : les appels successifs utilisent la sélection courante', () => {
  const a = action('replaceSelected', initialState());
  a.fn(1, 'd');
  const first = a.state();
  a.fn(2, 'd');
  assert.equal(a.state(), first, 'le doublon est détecté après le premier remplacement');
  a.fn(2, 'b');
  assert.deepEqual(Array.from(a.state().selected), ['a', 'd', 'b']);
});

function poweredRoster() {
  return Object.freeze([
    Object.freeze({ id: 'rare', base_hp: 100, level: 1, rarity: 'Rare' }), // 150
    Object.freeze({ id: 'high-level', base_hp: 10, level: 100, rarity: 'Common' }), // 39.7
    Object.freeze({ id: 'strong', base_hp: 300, level: 1, rarity: 'Common' }), // 300
    Object.freeze({ id: 'legendary', base_hp: 1, level: 1, rarity: 'Legendary' }), // 4
    Object.freeze({ id: 'middle', base_hp: 200, level: 1, rarity: 'Common' }), // 200
  ]);
}

test('selectTopThree : prend les trois plus puissantes dans l’ordre, même si elles sont déjà sélectionnées', () => {
  for (const selected of [[], ['rare'], ['rare', 'strong'], ['rare', 'strong', 'middle']]) {
    const initial = Object.freeze({ ...initialState(selected), roster: poweredRoster() });
    const a = action('selectTopThree', initial, { window: localWindow });
    a.fn();
    assert.deepEqual(Array.from(a.state().selected), ['strong', 'middle', 'rare']);
    assert.equal(a.state().roster, initial.roster);
    assert.equal(a.state().pvp, initial.pvp, 'la défense postée reste inchangée');
    assert.equal(a.state().view, 'arene');
    assert.equal(a.state().liquid, 700);
    assert.deepEqual(initial.roster.map((b) => b.id), ['rare', 'high-level', 'strong', 'legendary', 'middle']);
  }
});

test('selectTopThree : moins de trois entités disponibles ne modifie pas l’état', () => {
  for (const count of [0, 1, 2]) {
    const initial = Object.freeze({ ...initialState([]), roster: poweredRoster().slice(0, count) });
    const a = action('selectTopThree', initial, { window: localWindow });
    a.fn();
    assert.equal(a.state(), initial);
  }
});

test('selectTopThree : les entités retirées du roster ne sont jamais reprises', () => {
  const initial = Object.freeze({ ...initialState(['fused-away', 'rare', 'strong']), roster: poweredRoster() });
  const a = action('selectTopThree', initial, { window: localWindow });
  a.fn();
  assert.deepEqual(Array.from(a.state().selected), ['strong', 'middle', 'rare']);
  assert.equal(a.state().selected.includes('fused-away'), false);
});
