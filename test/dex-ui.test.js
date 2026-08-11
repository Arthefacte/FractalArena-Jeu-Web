const test = require("node:test");
const assert = require("node:assert");
const { prixTexte, variationTexte } = require("../dex-ui.js");

test("prixTexte : petit prix → décimales adaptées (3 chiffres significatifs, pas d'exponentielle)", () => {
  assert.strictEqual(prixTexte(0.00005927721868), "0.0000593");
  assert.strictEqual(prixTexte(0.000123456), "0.000123");
  assert.strictEqual(prixTexte(0.5), "0.500");
  assert.strictEqual(prixTexte(12.3456), "12.3");
});

test("prixTexte : prix absent ou invalide → null (le rendu masque la rangée)", () => {
  assert.strictEqual(prixTexte(null), null);
  assert.strictEqual(prixTexte(0), null);
  assert.strictEqual(prixTexte(-1), null);
  assert.strictEqual(prixTexte(NaN), null);
});

test("variationTexte : fraction → pourcentage signé à 2 décimales", () => {
  assert.strictEqual(variationTexte(0.0012534), "+0.13%");
  assert.strictEqual(variationTexte(-0.0567), "-5.67%");
  assert.strictEqual(variationTexte(0), "+0.00%");
  assert.strictEqual(variationTexte(undefined), "+0.00%");
});
