const action = async (action) => {
  try {
    await window.__TAURI_INTERNALS__.invoke('chrome_action', { action });
    document.getElementById('status').textContent = '';
  } catch (error) {
    console.error(error);
    document.getElementById('status').textContent = 'Action indisponible';
  }
};
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => action(button.dataset.action));
});
document.getElementById('drag').addEventListener('mousedown', event => {
  if (event.button === 0 && event.detail === 1) action('drag');
});
document.getElementById('drag').addEventListener('dblclick', () => action('maximize'));
window.addEventListener('keydown', event => {
  const selected = window.desktopShortcut(event);
  if (selected) { event.preventDefault(); action(selected); }
}, true);
