# Passer fractalarena.com derrière Cloudflare

**Objectif : de vrais en-têtes HTTP.** GitHub Pages n'en laisse poser aucun, ce
qui bloque aujourd'hui deux protections :

- **HSTS** — sans lui, la toute première visite en `http://` d'un navigateur qui
  n'a jamais vu la redirection reste interceptable.
- **`frame-ancestors` en en-tête** — la directive est bien déclarée dans la CSP
  du jeu, mais elle est délivrée par une balise `<meta>`, où **les navigateurs
  l'ignorent**. C'est `frame-guard.js` qui tient lieu de protection en attendant.

**Ce que ça n'apportera PAS : de la vitesse.** Mesuré le 2026-08-01 sur
fractalarena.com (téléphone simulé, CPU ÷4, premier écran à 9,7 s) :

| origine | requêtes | cumul |
|---|---|---|
| fractalarena.com | 68 | 9316 ms |
| unpkg.com | 2 | 145 ms |
| fonts.googleapis.com | 1 | 102 ms |

GitHub Pages est déjà servi par un CDN (Fastly, point de présence à Paris). Le
temps est dans les 68 requêtes vers l'origine — dont les modules Three.js, qui
s'importent en cascade et paient un aller-retour par niveau. C'est un autre
chantier (`modulepreload`, concaténation), pas un problème d'hébergeur.

## Pourquoi Cloudflare plutôt que Railway

Railway pourrait servir le site (le `Caddyfile` du dépôt existe déjà) et
permettrait les en-têtes, mais : bande passante facturée pour 94 Mo d'assets,
une seule région au lieu d'un CDN, et il faudrait déplacer l'hébergement au lieu
de simplement le compléter. Cloudflare se met **devant** GitHub Pages, en
gratuit, sans rien changer au déploiement (`git push` sur `main` continue de
publier).

## Étapes

### 1. Ajouter le site (à faire dans l'interface — le jeton API n'a pas le droit de créer une zone)

Cloudflare → **Add a site** → `fractalarena.com` → plan **Free**.

### 2. Importer les enregistrements DNS

**Ne pas se fier au scan automatique** : il rate régulièrement des
enregistrements.

DNS → Records → **Import and Export** → **Import DNS records** →
`docs/cloudflare-migration-dns.txt`.

> ⚠️ **Ce fichier est un instantané d'AVANT migration (2026-08-01), pas la
> cible.** Il contient les 5 MX de redirection d'e-mails qui existaient alors.
> Ils ont été **supprimés volontairement le jour même** : il n'y a pas de
> messagerie sur ce domaine, et un domaine qui n'envoie ni ne reçoit rien doit
> le dire, sinon il reste usurpable. Réimporter ce fichier tel quel
> **réintroduirait la messagerie** et annulerait ce verrouillage. S'en servir
> comme référence de lecture, en ne reprenant que les `A` et le `www`.

**État cible** (relevé en prod le 2026-08-02) :

| Enregistrement | Valeur | État |
|---|---|---|
| les 4 `A` + `www` | IP GitHub Pages | **Proxied** (orange) — c'est ce qui donne les en-têtes |
| `MX` | `.` (préférence 0) | **DNS only** — [null MX, RFC 7505](https://www.rfc-editor.org/rfc/rfc7505) : « ce domaine ne reçoit pas de courrier » |
| `TXT` @ | `v=spf1 -all` | **DNS only** — aucun serveur n'est autorisé à écrire en son nom |
| `TXT` `_dmarc` | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s` | **DNS only** — rejet, sous-domaines compris, alignement strict |

La clé DKIM a été révoquée. **Ne rien remettre ici sans décider d'abord de
rouvrir la messagerie** — ces quatre lignes ne valent que prises ensemble.

### 3. Changer les nameservers chez Namecheap

Cloudflare affiche deux nameservers. Namecheap → Domain List →
fractalarena.com → **Nameservers** → *Custom DNS* → coller les deux.

Propagation : quelques minutes à 24 h. **Le site reste en ligne pendant ce
temps** : les deux DNS pointent vers les mêmes IP GitHub Pages.

### 4. Réglages Cloudflare, une fois la zone active

- **SSL/TLS → Overview → Full** (surtout pas *Flexible* : boucle de redirection
  avec GitHub Pages, qui force déjà HTTPS).
- **SSL/TLS → Edge Certificates → Always Use HTTPS : on**
- **SSL/TLS → Edge Certificates → HSTS : on** — commencer avec `max-age` 6 mois,
  sans `preload`. ⚠️ HSTS est **difficilement réversible** : les navigateurs
  retiennent la consigne pour toute sa durée. Ne pas activer `preload` avant
  d'être certain que tout le domaine et ses sous-domaines restent en HTTPS.
- **Rules → Transform Rules → Modify Response Header**, ajouter :
  - `X-Frame-Options: DENY` (ou `Content-Security-Policy: frame-ancestors 'none'`)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 5. Cache Rule pour les modèles 3D (`.glb`)

**Le problème.** Cloudflare ne met en cache que les [extensions qu'il
reconnaît](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#default-cached-file-extensions)
— `js`, `css`, `png`, `mp3`… mais **pas `glb`**. Relevé en prod le 2026-08-02 :

| Fichier | `cf-cache-status` | `cache-control` d'origine |
|---|---|---|
| `styles.css`, `BACKGROUND.png`, `FA_intro.mp3` | HIT / REVALIDATED | `max-age=14400` |
| **`amber_cell.glb`, `logo3d.glb`** | **DYNAMIC** | **`max-age=600`** |

Or les `.glb` sont **64 des 110 Mo du jeu**, soit 58 % du poids total. Chaque
ouverture de relique repart donc jusqu'à GitHub Pages, dont la bande passante a
une limite douce de 100 Go/mois — et GitHub ne leur donne que 10 minutes de
fraîcheur navigateur, contre 4 h au reste, alors que ce sont des fichiers
immuables.

**La règle.** Caching → **Cache Rules** → *Create rule*, nom
`Modeles 3D — cache edge`, expression (onglet *Edit expression*) :

```
(ends_with(http.request.uri.path, ".glb"))
```

Réglages :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Cache eligibility | **Eligible for cache** | c'est tout l'objet de la règle |
| Edge TTL | **Ignore cache-control header and use this TTL** → **1 month** | on écrase le `max-age=600` de GitHub ; le cache Cloudflare, lui, se **purge d'un clic** |
| Browser TTL | **ne pas ajouter le réglage** | ⚠️ voir ci-dessous |

Aucun des autres réglages (Cache key, Vary, Serve stale, ETags…) n'est touché.

**Effet de bord constaté après déploiement** : le `cache-control` renvoyé aux
joueurs pour les `.glb` est passé de `max-age=600` à **`max-age=14400`**. En
laissant Browser TTL vide, ce n'est pas l'origine qui décide mais le **Browser
Cache TTL de la zone** (Caching → Configuration, 4 h par défaut). Donc 4 h de
cache navigateur, pas 10 min — acceptable, et sans commune mesure avec l'année
qu'on refuse ci-dessous, mais à savoir : remplacer un `.glb` reste invisible
jusqu'à 4 h pour qui vient de le charger.

**Pourquoi ne PAS allonger le Browser TTL.** Les `.glb` sont chargés sans
cache-buster — `assets/relics/<type>.glb` (`relic-assets.js:13`),
`assets/logo3d.glb`, `assets/Emblem_optimise_12Mo.glb` — contrairement aux `.js`
qui portent `?v=N`. Un cache navigateur long rendrait donc tout remplacement de
modèle invisible pour les joueurs déjà venus, **sans aucun moyen de purger** :
on ne purge que le cache Cloudflare, jamais celui des navigateurs. C'est
exactement le scénario de l'allègement prévu d'`amber_cell.glb` (1,87 M
triangles). Le gain recherché — bande passante GitHub et vitesse — vient de
l'Edge TTL ; le Browser TTL n'y ajoute presque rien.

Pour l'obtenir quand même : ajouter d'abord `?v=N` aux chemins `.glb` (même
convention que les `.js`), puis seulement passer le Browser TTL à 1 an.

**À faire dans l'interface, pas par l'API.** Vérifié le 2026-08-02 : le jeton
courant liste bien les zones (`GET /zones` → zone `9b00f268…`), mais
`GET /zones/{id}/rulesets/phases/{phase}/entrypoint` répond *request is not
authorized* — pour la phase cache **comme** pour celle des en-têtes — et
`/user/tokens/verify` renvoie *Invalid API Token*. Il faudrait un jeton portant
**Zone → Cache Rules → Edit** sur `fractalarena.com` pour scripter cette étape.

**Vérification** (attendre ~30 s après création) :

```sh
curl -sI https://fractalarena.com/assets/relics/amber_cell.glb | grep -i cf-cache-status
# 1er appel : MISS   —   2e appel : HIT   (avant la règle : DYNAMIC)
```

**Déployée et vérifiée le 2026-08-02** — règle « Modeles 3D (.glb) - cache
edge », active, ordre 1. Séquence relevée sur `amber_cell.glb` et `logo3d.glb` :
`DYNAMIC` → `MISS` → `HIT` → `HIT`.

Si la règle ne s'applique pas, **Rules → Trace** rejoue une URL et montre
laquelle a matché.

> Le `manifest.webmanifest` est lui aussi en DYNAMIC, pour la même raison. Il
> pèse 1 Ko : le laisser tel quel ne coûte rien.

### 6. Après bascule — à vérifier

```sh
curl -sI https://fractalarena.com/ | grep -iE "strict-transport|x-frame|x-content|server"
curl -sI http://fractalarena.com/ | head -3          # doit rester 301
nslookup -type=MX fractalarena.com                    # doit répondre UN SEUL MX : "." (null MX)
nslookup -type=TXT fractalarena.com                   # doit contenir v=spf1 -all
nslookup -type=TXT _dmarc.fractalarena.com            # doit contenir p=reject
```

⚠️ Le contrôle de la messagerie s'est **inversé** depuis la migration : ce qu'on
vérifie n'est plus qu'un mail arrive, mais qu'**aucun ne puisse partir ni
arriver**. Un MX autre que `.` qui réapparaîtrait — réimport du fichier DNS,
scan automatique, « helpful defaults » d'un hébergeur — est une **régression**,
pas un retour à la normale.

**Garder `frame-guard.js`** même une fois `frame-ancestors` en en-tête : deux
verrous valent mieux qu'un, et il protège encore si le proxy est désactivé un
jour.
