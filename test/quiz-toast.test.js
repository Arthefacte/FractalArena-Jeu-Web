// test/quiz-toast.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = lire("quiz.jsx");
const css = lire("styles.css");
const app = lire("app.jsx");
const html = lire("index.html");

test("les deux boutons passent par i18n, jamais de texte en dur", () => {
  assert.match(src, /QUIZ_KEEP/);
  assert.match(src, /QUIZ_GIVE/);
  assert.ok(!/Garder 10 FA/.test(src), "libelle en dur");
});

test("le choix de destination n'apparait pas en revision", () => {
  assert.match(src, /revision/);
});

test("les deux boutons partagent la meme classe CSS (poids visuel identique)", () => {
  const boutons = src.match(/className="[^"]*quiz-choice[^"]*"/g) || [];
  assert.ok(boutons.length >= 2, "les deux boutons doivent porter la meme classe");
});

test("la classe du toast existe dans styles.css", () => {
  assert.match(css, /\.quiz-toast/);
});

// Une question ignoree n'est pas consommee : l'auto-effacement ferme le toast
// sans appeler /quiz/answer, sinon le joueur perdrait la question sans y toucher.
// Le bug : apres la reponse, la bulle se refermait au bout de 6 s — le temps de
// lire l'explication, le choix garder/offrir avait disparu. Aucune duree ne doit
// plus vivre en dur dans le composant.
test("aucun delai d'effacement en dur dans le composant", () => {
  assert.ok(!/\b6000\b/.test(src), "6000 ms en dur : le joueur n'a pas le temps de choisir");
  assert.match(src, /QUIZ\.QUIZ_TOAST_MS/, "la duree vient de la logique pure");
});

// Le joueur doit voir venir la fermeture, sinon la bulle disparait sans preavis.
test("la bulle affiche un decompte", () => {
  assert.match(src, /restantSecondes/, "le decompte vient de la logique pure");
  assert.match(src, /quiz-countdown/);
  assert.match(src, /QUIZ_SECONDS/);
  assert.match(css, /\.quiz-countdown/);
});

// Meme horloge pour l'affichage et la fermeture : deux minuteries separees se
// desynchronisent, et la bulle se ferme avant la fin du compte affiche.
test("le decompte est ce qui ferme la bulle, pas un second minuteur", () => {
  assert.ok(!/setTimeout\([^)]*fermer/.test(src), "un setTimeout parallele au decompte");
  assert.match(src, /if\s*\(\s*r\s*<=\s*0\s*\)\s*fermer\(\)/);
});

// Sans choix, la bulle se ferme et rien n'est offert : le joueur doit le savoir
// AVANT, pas le decouvrir en voyant la bulle disparaitre.
test("le joueur est prevenu de ce qui arrive s'il ne choisit pas", () => {
  assert.match(src, /QUIZ_TIMEOUT/);
  assert.match(css, /\.quiz-timeout/);
});

// Explication lue, rien a decider : le joueur ne doit pas attendre la fin du
// decompte pour recuperer son ecran.
test("une croix ferme la bulle une fois l'explication lue", () => {
  assert.match(src, /quiz-close/);
  assert.match(css, /\.quiz-close/);
  const bouton = src.match(/<button[^>]*quiz-close[^>]*>/);
  assert.ok(bouton, "bouton de fermeture introuvable");
  assert.match(bouton[0], /onClick=\{fermer\}/, "la croix doit appeler fermer()");
});

// La croix ne s'affiche QUE quand il n'y a plus rien a decider. Tant que
// garder/offrir est a l'ecran, une croix serait une troisieme sortie qui vaut
// « garder » : garder deviendrait accessible a deux endroits, offrir a un seul,
// et les deux options cesseraient de peser pareil.
test("pas de croix tant que le choix garder/offrir est a l'ecran", () => {
  assert.match(src, /verdict\s*&&\s*!choixEnAttente\s*&&[\s\S]{0,200}quiz-close/,
    "la croix doit etre gardee par `verdict && !choixEnAttente`");
});

// Une croix sans nom n'est qu'un pictogramme : les lecteurs d'ecran doivent
// l'annoncer, et le libelle passe par i18n comme tout le reste de la bulle.
test("la croix porte un nom accessible traduit", () => {
  const bouton = src.match(/<button[^>]*quiz-close[^>]*>/);
  assert.match(bouton[0], /aria-label=\{I18N\.t\("QUIZ_CLOSE"\)\}/);
});

// Aucune bulle pendant un combat, une modale ou une signature : un seul point de
// verite (la classe fa-busy sur <body>), pose par FA_SET_BUSY.
test("le drapeau d'occupation est expose et consomme", () => {
  assert.match(src, /FA_SET_BUSY/);
  assert.match(src, /fa-busy/);
  assert.match(src, /\.overlay/);
});

test("la signature UniSat marque l'application occupee", () => {
  const bloc = app.slice(app.indexOf("signMessage") - 400, app.indexOf("signMessage") + 200);
  assert.match(bloc, /FA_SET_BUSY|pendantSignature/);
});

test("le toast est monte et son script charge", () => {
  assert.match(app, /<window\.QuizToast/);
  assert.match(html, /quiz-ui\.js\?v=/);
  assert.match(html, /build\/quiz\.js\?v=/);
});
