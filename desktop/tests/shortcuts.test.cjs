const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const shared = readFileSync('ui/shortcuts.js', 'utf8');
const init = readFileSync('src-tauri/src/game-init.js', 'utf8');
function setup(origin = 'https://game.test', topFrame = true) {
  const handlers = {};
  const calls = [];
  const window = { addEventListener: (name, fn) => { handlers[name] = fn; },
    __TAURI_INTERNALS__: { invoke: (...args) => { calls.push(args); return Promise.resolve(); } } };
  window.top = topFrame ? window : {};
  runInNewContext(shared + init.replace('__GAME_ORIGIN__', JSON.stringify('https://game.test')),
    { window, location: { origin }, console });
  return { window, handlers, calls };
}
function event(key, overrides = {}) {
  return { key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false,
    isTrusted: true, preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }, ...overrides };
}
test('all four shortcuts consume the key and send only the expected action', () => {
  const { handlers, calls } = setup();
  for (const [e, action] of [
    [event('F5'), 'reload'], [event('F11'), 'fullscreen'],
    [event('q', { ctrlKey: true }), 'quit'],
    [event('I', { ctrlKey: true, shiftKey: true }), 'devtools']
  ]) {
    handlers.keydown(e);
    assert.equal(e.prevented, true);
    assert.equal(e.stopped, true);
    assert.equal(calls.at(-1)[0], 'game_action');
    assert.equal(calls.at(-1)[1].action, action);
  }
});
test('typing, modifier combinations, repeats and synthetic keys cannot trigger controls', () => {
  const { handlers, calls } = setup();
  for (const e of [event('q'), event('i'), event('F11', { repeat: true }),
    event('F5', { altKey: true }), event('F5', { ctrlKey: true }),
    event('q', { ctrlKey: true, shiftKey: true }), event('F5', { isTrusted: false })]) {
    handlers.keydown(e);
    assert.equal(e.prevented, undefined);
  }
  assert.equal(calls.length, 0);
});
test('initialization never attaches a native bridge on another origin or subframe', () => {
  assert.equal(setup('https://other.test').handlers.keydown, undefined);
  assert.equal(setup('https://game.test', false).handlers.keydown, undefined);
});
