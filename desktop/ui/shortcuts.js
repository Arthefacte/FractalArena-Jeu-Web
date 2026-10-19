// Shared by the local title bar and the remote game's initialization script.
(() => {
  window.desktopShortcut = (event) => {
    if (event.altKey || event.metaKey || event.repeat) return null;
    if (!event.ctrlKey && !event.shiftKey && event.key === 'F5') return 'reload';
    if (!event.ctrlKey && !event.shiftKey && event.key === 'F11') return 'fullscreen';
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'q') return 'quit';
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'i') return 'devtools';
    return null;
  };
})();
