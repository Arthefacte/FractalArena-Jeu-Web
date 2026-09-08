// test/referral-ui.test.js — logique pure du parrainage (spec 2026-09-07).
// Les constantes MIROIRENT fractal-arena-server/referral.js : alphabet sans
// 0/O ni 1/I/l, 8 caractères. Si l'un bouge, l'autre doit bouger.
const test = require("node:test");
const assert = require("node:assert");

require("../referral-ui.js");
const RU = global.window.FA_REFERRAL;

test("les constantes miroirent le serveur (referral.js)", () => {
  assert.strictEqual(RU.CODE_ALPHABET, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
  assert.strictEqual(RU.CODE_LEN, 8);
});

test("normalizeRefCode : trim + majuscules, format strict, reste rejete", () => {
  assert.strictEqual(RU.normalizeRefCode("abcd2345"), "ABCD2345");
  assert.strictEqual(RU.normalizeRefCode("  ABCD2345 "), "ABCD2345");
  assert.strictEqual(RU.normalizeRefCode("ABCD234"), null, "7 caracteres");
  assert.strictEqual(RU.normalizeRefCode("ABCD23456"), null, "9 caracteres");
  assert.strictEqual(RU.normalizeRefCode("ABCD0OI1"), null, "0/O/I/1 hors alphabet");
  assert.strictEqual(RU.normalizeRefCode(""), null);
  assert.strictEqual(RU.normalizeRefCode(null), null);
  assert.strictEqual(RU.normalizeRefCode(12345678), null, "chaine uniquement");
});

test("parseRefSearch : lit ?ref= dans la query string, insensible a la casse, sinon null", () => {
  assert.strictEqual(RU.parseRefSearch("?ref=ABCD2345"), "ABCD2345");
  assert.strictEqual(RU.parseRefSearch("?ref=abcd2345"), "ABCD2345");
  assert.strictEqual(RU.parseRefSearch("?utm=x&ref=ABCD2345&y=1"), "ABCD2345");
  assert.strictEqual(RU.parseRefSearch("?ref=ABCD2345%20"), "ABCD2345", "encodage URL tolere");
  assert.strictEqual(RU.parseRefSearch("?ref=BAD"), null, "code hors format → rien a transmettre");
  assert.strictEqual(RU.parseRefSearch("?other=1"), null);
  assert.strictEqual(RU.parseRefSearch(""), null);
  assert.strictEqual(RU.parseRefSearch(undefined), null);
});

test("referralLink : le lien a partager est https://fractalarena.com/?ref=CODE", () => {
  assert.strictEqual(RU.referralLink("ABCD2345"), "https://fractalarena.com/?ref=ABCD2345");
  // Un lien produit par referralLink se relit avec parseRefSearch (aller-retour).
  const url = new URL(RU.referralLink("WXYZ6789"));
  assert.strictEqual(RU.parseRefSearch(url.search), "WXYZ6789");
});

test("refBody : { ref } si un code bien forme est present, {} sinon (le serveur rejette le reste)", () => {
  assert.deepStrictEqual(RU.refBody("ABCD2345"), { ref: "ABCD2345" });
  assert.deepStrictEqual(RU.refBody(null), {});
  assert.deepStrictEqual(RU.refBody("bad"), {});
});
