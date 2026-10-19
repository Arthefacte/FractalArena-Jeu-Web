(() => {
  if (window.top !== window || location.origin !== __GAME_ORIGIN__) return;
  window.addEventListener('keydown', event => {
    const action = window.desktopShortcut(event);
    if (!action || !event.isTrusted) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.__TAURI_INTERNALS__.invoke('game_action', { action }).catch(console.error);
  }, true);
})();
