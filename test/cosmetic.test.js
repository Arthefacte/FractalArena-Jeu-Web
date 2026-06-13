const test = require("node:test");
const assert = require("node:assert");
const { cosmeticEnemyScale } = require("../cosmetic.js");

const beast = (over) => Object.assign(
  { base_hp: 600, base_atk: 90, base_def: 60, base_spd: 80, base_mag: 90, level: 1 }, over);
const rngMid = () => 0.5; // → cible = joueur × 0.925

test("ennemi plus faible → K>1, affiché ≈ 85–100% du joueur", () => {
  const player = [beast()];                  // total 920
  const enemy = [beast({ base_hp: 200, base_atk: 30, base_def: 20, base_spd: 25, base_mag: 30 })]; // 305
  const [k] = cosmeticEnemyScale(enemy, player, rngMid);
  assert.ok(k > 1, `k=${k}`);
  assert.ok(Math.abs(305 * k - 920 * 0.925) < 1, `affiche=${305 * k}`);
});

test("ennemi déjà ≥ joueur → K=1 (jamais de réduction)", () => {
  const [k] = cosmeticEnemyScale([beast({ base_hp: 2000 })], [beast()], rngMid);
  assert.strictEqual(k, 1);
});

test("profil préservé : ratio HP/ATK identique après scaling", () => {
  const [k] = cosmeticEnemyScale([beast({ base_hp: 200, base_atk: 40 })], [beast()], rngMid);
  assert.strictEqual((200 * k) / (40 * k), 200 / 40);
});

test("plafond ×12 : ennemi minuscule vs joueur énorme", () => {
  const player = [beast({ base_hp: 100000 })];
  const enemy = [beast({ base_hp: 1, base_atk: 1, base_def: 1, base_spd: 1, base_mag: 1 })];
  const [k] = cosmeticEnemyScale(enemy, player, rngMid);
  assert.strictEqual(k, 12);
});

test("enemyTotal=0 ou bête absente → K=1, pas de crash", () => {
  const player = [beast()];
  assert.deepStrictEqual(cosmeticEnemyScale([null], player, rngMid), [1]);
  assert.deepStrictEqual(
    cosmeticEnemyScale([beast({ base_hp: 0, base_atk: 0, base_def: 0, base_spd: 0, base_mag: 0 })], player, rngMid),
    [1]);
});

test("3v3 : un K par colonne", () => {
  const ks = cosmeticEnemyScale([beast(), beast(), beast()], [beast(), beast(), beast()], rngMid);
  assert.strictEqual(ks.length, 3);
});
