const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const TYPES = ["BLOCK", "GENESIS", "HASHBYTE", "LEDGER", "MINER", "NETWORK"];
const RANKS = ["C", "B", "A", "S"];

test("24 fichiers d'art par rang présents, non vides, < 400 Ko", () => {
  for (const t of TYPES) for (const r of RANKS) {
    const p = path.join(__dirname, "..", "assets", `${t}_${r}.webp`);
    assert.ok(fs.existsSync(p), "manquant : " + p);
    const size = fs.statSync(p).size;
    assert.ok(size > 10 * 1024 && size < 400 * 1024, `${t}_${r}.webp : ${size} octets`);
  }
});
