// Les outils du header (❓ quiz, 💬 support, 👥 salon) vivent dans la barre
// PARTOUT depuis la v229 — plus aucune bulle flottante, ni desktop ni mobile.
// Seul le caret ▼ des pools reste mobile-only (en desktop le bandeau est déplié).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const CSS = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const MOB = fs.readFileSync(path.join(__dirname, "..", "mobile.css"), "utf8");

test("styles.css : .hdr-mtools visible en base (desktop inclus), jamais display:none", () => {
  assert.match(CSS, /\.hdr-mtools\s*\{[^}]*display:\s*flex/, ".hdr-mtools doit être en flex dans styles.css");
  assert.doesNotMatch(CSS, /\.hdr-mtools\s*\{\s*display:\s*none/, "l'ancien masquage desktop doit disparaître");
});

test("styles.css : les trois bulles flottantes sont masquées globalement", () => {
  assert.match(CSS, /\.chat-fab,\s*\.room-fab,\s*\.quiz-fab\s*\{[^}]*display:\s*none/,
    "chat-fab/room-fab/quiz-fab masqués dans styles.css (plus seulement mobile.css)");
});

test("le caret des pools reste mobile-only : masqué en base, réaffiché dans mobile.css", () => {
  assert.match(CSS, /\.hdr-mcaret[^}]*display:\s*none/, "caret masqué en desktop (bandeau toujours déplié)");
  assert.match(MOB, /\.hdr-mcaret[^{]*\{[^}]*display:\s*grid/, "mobile.css réaffiche le caret");
});

test("mobile.css ne duplique plus les styles des boutons du header", () => {
  assert.doesNotMatch(MOB, /\.hdr-mbtn\s*\{/, ".hdr-mbtn est défini une seule fois, dans styles.css");
  assert.doesNotMatch(MOB, /\.hdr-mdot\s*\{/, ".hdr-mdot est défini une seule fois, dans styles.css");
});
