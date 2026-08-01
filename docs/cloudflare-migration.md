# fractalarena.com derrière Cloudflare — FAIT le 2026-08-01

> ✅ **Migration effectuée et vérifiée.** Zone Cloudflare créée (plan Free), les
> 11 enregistrements DNS importés depuis le relevé, nameservers Namecheap
> remplacés par `andy.ns.cloudflare.com` / `deb.ns.cloudflare.com`. DNSSEC était
> déjà désactivé (vérifié dans l'interface ET par l'absence d'enregistrement DS)
> — c'était le point qui aurait rendu le domaine irrésolvable.
>
> Réglages posés : **SSL Full (Strict)**, **Always Use HTTPS**, **HSTS 6 mois**
> (sans `includeSubDomains`, sans `preload`), et une règle *Response Header
> Transform* « En-tetes de securite ».
>
> En-têtes constatés en production :
> ```
> Strict-Transport-Security: max-age=15552000
> X-Frame-Options: DENY
> X-Content-Type-Options: nosniff
> Referrer-Policy: strict-origin-when-cross-origin
> ```
> Vérifié après bascule : jeu monté, 3D et reliques meshopt chargées, service
> worker actif, `http://` → 301, **les 5 MX intacts**.
>
> Ce qui suit est la recette d'origine, conservée pour mémoire.

## Pourquoi c'était nécessaire

GitHub Pages ne laisse poser aucun en-tête, ce qui bloquait deux protections :

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
enregistrements, et ici ce sont les 5 MX + le SPF qui portent la **redirection
d'e-mails** du domaine. Les perdre ferait disparaître les mails sans aucun
signal.

DNS → Records → **Import and Export** → **Import DNS records** →
`docs/cloudflare-migration-dns.txt` (relevé le 2026-08-01 avant migration).

Puis vérifier les nuages :

| Enregistrement | État |
|---|---|
| les 4 `A` + `www` | **Proxied** (orange) — c'est ce qui donne les en-têtes |
| les 5 `MX` + le `TXT` | **DNS only** (gris) — un MX proxifié casse le courrier |

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

### 5. Après bascule — à vérifier

```sh
curl -sI https://fractalarena.com/ | grep -iE "strict-transport|x-frame|x-content|server"
curl -sI http://fractalarena.com/ | head -3          # doit rester 301
nslookup -type=MX fractalarena.com                    # les 5 eforward doivent répondre
```

Et **envoyer un mail de test** à une adresse du domaine : c'est le seul contrôle
qui prouve que la redirection a survécu.

**Garder `frame-guard.js`** même une fois `frame-ancestors` en en-tête : deux
verrous valent mieux qu'un, et il protège encore si le proxy est désactivé un
jour.
