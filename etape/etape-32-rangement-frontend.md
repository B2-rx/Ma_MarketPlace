# Jour 4, Étape 32 : Ranger le Front_end par dossiers

## Le principe

Aujourd'hui, les fichiers sont rangés **par type** : tous les `.js` ensemble, tous les `.html` ensemble, un seul gros `.css`. On passe à un rangement **par fonctionnalité** : une page (ou un petit groupe de pages) = un dossier, avec son HTML, son JavaScript et son CSS.

Les fichiers ne sont **pas renommés**. Ils changent de dossier, ce qui change leur adresse dans le navigateur : toutes les références (`<script src>`, `<link href>`, `import`, liens du menu) doivent suivre. Un script s'en charge, et tu relis le résultat avant de commiter.

## Le rangement final

```
Front_end/
├── index.html                          page d'accueil (adresse « / »)
├── accueil/
│   └── accueil.js
├── partage/                            ce qui sert à toutes les pages
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js
│       ├── menu.js
│       ├── outils.js
│       ├── secteurs.js
│       ├── session.js
│       └── validation.js
├── connexion/
│   ├── connexion.html
│   └── connexion.js
├── inscription/
│   ├── inscription.css
│   ├── inscription.html
│   └── inscription.js
├── etablissements/
│   ├── etablissements.css
│   ├── fiche-etablissement.html
│   ├── fiche-etablissement.js
│   ├── liste-etablissements.html
│   └── liste-etablissements.js
├── panier/
│   ├── ajout-panier.js
│   ├── page-panier.js
│   ├── panier.css
│   └── panier.html
├── commandes/
│   ├── commandes.css
│   ├── mes-commandes.html
│   ├── mes-commandes.js
│   ├── page-mes-commandes.js
│   ├── page-suivi-commande.js
│   └── suivi-commande.html
└── commercant/
    └── tableau-de-bord/
        ├── page-tableau-de-bord.js
        ├── tableau-de-bord.css
        └── tableau-de-bord.html
```

> Dans `commandes/`, ne copie pas le fichier `mes-commandes.js` : il n'existe pas. L'arbre ci-dessus contient `page-mes-commandes.js` et `page-suivi-commande.js`, rien d'autre en JavaScript.

**Règle pour la suite** : une nouvelle page = un nouveau dossier avec son `.html`, son `.js` et, si besoin, son `.css`. Ce qui sert à plusieurs pages va dans `partage/`.

Les adresses changent ainsi :

| Avant | Après |
|---|---|
| `/connexion.html` | `/connexion/connexion.html` |
| `/inscription.html` | `/inscription/inscription.html` |
| `/liste-etablissements.html` | `/etablissements/liste-etablissements.html` |
| `/fiche-etablissement.html` | `/etablissements/fiche-etablissement.html` |
| `/panier.html` | `/panier/panier.html` |
| `/suivi-commande.html` | `/commandes/suivi-commande.html` |
| `/mes-commandes.html` | `/commandes/mes-commandes.html` |
| `/commercant/tableau-de-bord.html` | `/commercant/tableau-de-bord/tableau-de-bord.html` |

Le Back_end ne change pas : `server.js` sert déjà tout le dossier `Front_end`, quelle que soit son organisation.

---

## Avant de commencer

1. La Pull Request de l'étape 31 doit être **fusionnée** dans `main` : le script utilise `git mv`, qui ne fonctionne que sur des fichiers déjà enregistrés.
2. `git status` doit afficher `nothing to commit, working tree clean`.
3. Arrête le serveur (`Ctrl + C`).

```powershell
git switch main
git pull
git switch -c frontend-rangement
```

Si quelque chose tourne mal, tu reviens en arrière sans rien perdre : `git switch main`, puis `git branch -D frontend-rangement`.

---

## Phase 1 : déplacer les fichiers et corriger les références

### 1. Créer le script

À la **racine du projet** (à côté de `Front_end` et `Back_end`), crée le fichier `rangement-front.ps1` et colle :

```powershell
# ===== rangement-front.ps1 : range Front_end par dossiers de fonctionnalité =====
# À lancer UNE SEULE FOIS, à la racine du projet, sur la branche frontend-rangement.

$ErrorActionPreference = 'Stop'

# Garde-fous : on vérifie qu'on est au bon endroit, et que le rangement n'est pas déjà fait
if (-not (Test-Path 'Front_end/js/api.js')) {
  throw "Front_end/js/api.js est introuvable : lance le script depuis la racine du projet, avant le rangement."
}

if (Test-Path 'Front_end/partage') {
  throw "Front_end/partage existe déjà : le rangement semble déjà fait."
}


# ----- 1. Les déplacements (ancien chemin = nouveau chemin) -----
# git mv garde l'historique de chaque fichier.
$deplacements = [ordered]@{
  'Front_end/css/style.css'                       = 'Front_end/partage/css/style.css'
  'Front_end/js/api.js'                           = 'Front_end/partage/js/api.js'
  'Front_end/js/menu.js'                          = 'Front_end/partage/js/menu.js'
  'Front_end/js/outils.js'                        = 'Front_end/partage/js/outils.js'
  'Front_end/js/secteurs.js'                      = 'Front_end/partage/js/secteurs.js'
  'Front_end/js/session.js'                       = 'Front_end/partage/js/session.js'
  'Front_end/js/validation.js'                    = 'Front_end/partage/js/validation.js'

  'Front_end/js/accueil.js'                       = 'Front_end/accueil/accueil.js'

  'Front_end/connexion.html'                      = 'Front_end/connexion/connexion.html'
  'Front_end/js/connexion.js'                     = 'Front_end/connexion/connexion.js'

  'Front_end/inscription.html'                    = 'Front_end/inscription/inscription.html'
  'Front_end/js/inscription.js'                   = 'Front_end/inscription/inscription.js'

  'Front_end/liste-etablissements.html'           = 'Front_end/etablissements/liste-etablissements.html'
  'Front_end/js/liste-etablissements.js'          = 'Front_end/etablissements/liste-etablissements.js'
  'Front_end/fiche-etablissement.html'            = 'Front_end/etablissements/fiche-etablissement.html'
  'Front_end/js/fiche-etablissement.js'           = 'Front_end/etablissements/fiche-etablissement.js'

  'Front_end/panier.html'                         = 'Front_end/panier/panier.html'
  'Front_end/js/page-panier.js'                   = 'Front_end/panier/page-panier.js'
  'Front_end/js/ajout-panier.js'                  = 'Front_end/panier/ajout-panier.js'

  'Front_end/suivi-commande.html'                 = 'Front_end/commandes/suivi-commande.html'
  'Front_end/js/page-suivi-commande.js'           = 'Front_end/commandes/page-suivi-commande.js'
  'Front_end/mes-commandes.html'                  = 'Front_end/commandes/mes-commandes.html'
  'Front_end/js/page-mes-commandes.js'            = 'Front_end/commandes/page-mes-commandes.js'

  'Front_end/commercant/tableau-de-bord.html'     = 'Front_end/commercant/tableau-de-bord/tableau-de-bord.html'
  'Front_end/js/page-tableau-de-bord.js'          = 'Front_end/commercant/tableau-de-bord/page-tableau-de-bord.js'
}

foreach ($source in $deplacements.Keys) {
  $destination = $deplacements[$source]

  if (-not (Test-Path $source)) {
    throw "Fichier introuvable : $source"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null

  git mv $source $destination

  if ($LASTEXITCODE -ne 0) {
    throw "git mv a échoué pour : $source"
  }
}


# ----- 2. Les anciennes adresses et leurs nouvelles -----
# Les adresses commencent toutes par "/" : ce sont celles écrites dans les pages,
# les scripts et les fichiers de test.
$adresses = @{
  '/connexion.html'                       = '/connexion/connexion.html'
  '/inscription.html'                     = '/inscription/inscription.html'
  '/liste-etablissements.html'            = '/etablissements/liste-etablissements.html'
  '/fiche-etablissement.html'             = '/etablissements/fiche-etablissement.html'
  '/panier.html'                          = '/panier/panier.html'
  '/suivi-commande.html'                  = '/commandes/suivi-commande.html'
  '/mes-commandes.html'                   = '/commandes/mes-commandes.html'
  '/commercant/tableau-de-bord.html'      = '/commercant/tableau-de-bord/tableau-de-bord.html'

  # Pages qui n'existent pas encore : le menu pointe déjà vers leur futur dossier
  '/commercant/historique-commandes.html' = '/commercant/historique-commandes/historique-commandes.html'
  '/commercant/ma-boutique.html'          = '/commercant/ma-boutique/ma-boutique.html'
  '/commercant/produits.html'             = '/commercant/produits/produits.html'

  '/css/style.css'                        = '/partage/css/style.css'
  '/js/api.js'                            = '/partage/js/api.js'
  '/js/menu.js'                           = '/partage/js/menu.js'
  '/js/outils.js'                         = '/partage/js/outils.js'
  '/js/secteurs.js'                       = '/partage/js/secteurs.js'
  '/js/session.js'                        = '/partage/js/session.js'
  '/js/validation.js'                     = '/partage/js/validation.js'

  '/js/accueil.js'                        = '/accueil/accueil.js'
  '/js/connexion.js'                      = '/connexion/connexion.js'
  '/js/inscription.js'                    = '/inscription/inscription.js'
  '/js/liste-etablissements.js'           = '/etablissements/liste-etablissements.js'
  '/js/fiche-etablissement.js'            = '/etablissements/fiche-etablissement.js'
  '/js/page-panier.js'                    = '/panier/page-panier.js'
  '/js/ajout-panier.js'                   = '/panier/ajout-panier.js'
  '/js/page-suivi-commande.js'            = '/commandes/page-suivi-commande.js'
  '/js/page-mes-commandes.js'             = '/commandes/page-mes-commandes.js'
  '/js/page-tableau-de-bord.js'           = '/commercant/tableau-de-bord/page-tableau-de-bord.js'
}

# UNE seule passe : une adresse déjà remplacée n'est jamais remplacée une seconde fois
$motif = ($adresses.Keys | Sort-Object Length -Descending | ForEach-Object { [regex]::Escape($_) }) -join '|'

$evaluateur = [System.Text.RegularExpressions.MatchEvaluator]{
  param($correspondance)
  $script:adresses[$correspondance.Value]
}

# Les imports de la forme  from './api.js'  dans les pages (hors partage/)
$importsPartages = [regex]"from '\./(api|outils|session|validation|secteurs|menu)\.js'"


# ----- 3. Mise à jour des fichiers -----
$utf8 = New-Object System.Text.UTF8Encoding($false)

$fichiers = @(Get-ChildItem 'Front_end' -Recurse -File -Include *.html, *.js)
$fichiers += @(Get-ChildItem 'tests-api' -File -Filter *.http)

foreach ($fichier in $fichiers) {
  $chemin = $fichier.FullName.Replace('\', '/')
  $ancien = [System.IO.File]::ReadAllText($fichier.FullName, $utf8)
  $nouveau = [regex]::Replace($ancien, $motif, $evaluateur)

  # Une page (hors partage/) importait ses outils avec "./" : le chemin devient absolu
  if ($chemin -like '*/Front_end/*' -and $chemin -notlike '*/Front_end/partage/*' -and $fichier.Extension -eq '.js') {
    $nouveau = $importsPartages.Replace($nouveau, 'from ''/partage/js/$1.js''')
    $nouveau = $nouveau.Replace("from './ajout-panier.js'", "from '/panier/ajout-panier.js'")
  }

  if ($nouveau -ne $ancien) {
    [System.IO.File]::WriteAllText($fichier.FullName, $nouveau, $utf8)
    Write-Host "Modifié : $chemin"
  }
}


# ----- 4. Nettoyage : les anciens dossiers vides -----
foreach ($dossier in 'Front_end/js', 'Front_end/css') {
  if ((Test-Path $dossier) -and -not (Get-ChildItem $dossier -Force)) {
    Remove-Item $dossier
  }
}

Write-Host ''
Write-Host 'Rangement terminé. Vérifie avec : git status'
```

### 2. Lancer le script

À la racine du projet :

```powershell
powershell -ExecutionPolicy Bypass -File .\rangement-front.ps1
```

Le script affiche la liste des fichiers modifiés, puis « Rangement terminé ».

- Si il répond `Front_end/js/api.js est introuvable`, tu n'es pas à la racine, ou le rangement est déjà fait.
- Si il s'arrête sur `Fichier introuvable : ...`, un fichier n'existe pas sous ce nom chez toi. Rien n'a été déplacé **avant** ce fichier-là : note le nom et dis-le-moi.

### 3. Vérifier qu'il ne reste aucune ancienne adresse

Chaque commande doit **ne rien afficher** :

```powershell
# Anciennes adresses /js/... et /css/... oubliées
Get-ChildItem Front_end -Recurse -File -Include *.html, *.js | Select-String -Pattern "[`"']/(js|css)/"

# Imports "./" restants dans les pages (seul partage/ a le droit d'en avoir)
Get-ChildItem Front_end -Recurse -File -Include *.js | Where-Object { $_.FullName -notlike '*\partage\*' } | Select-String -Pattern "from '\./"

# Anciennes adresses de pages
Get-ChildItem Front_end, tests-api -Recurse -File | Select-String -Pattern "(?<![a-z])/(connexion|inscription|panier|liste-etablissements|fiche-etablissement|suivi-commande|mes-commandes)\.html"
```

Si une ligne s'affiche, ouvre le fichier indiqué et corrige l'adresse à la main, d'après le tableau ci-dessus.

### 4. Corriger à la main les adresses sans extension

Dans `tests-api`, certaines requêtes utilisent une adresse **sans** `.html` : le script ne les a pas touchées, car elles se confondent avec les adresses de l'API. Cherche-les :

```powershell
Select-String -Path tests-api/frontend-*.http -Pattern "localhost:3000/(inscription|panier|suivi-commande|mes-commandes|fiche-etablissement|commercant/tableau-de-bord)\s*$"
```

Remplace chaque résultat par la nouvelle adresse complète, par exemple :

- `GET http://localhost:3000/inscription` devient `GET http://localhost:3000/inscription/inscription`
- `GET http://localhost:3000/panier` devient `GET http://localhost:3000/panier/panier`

### 5. Relire ce que le script a changé

```powershell
git status
git diff --stat
```

`git status` montre les fichiers **renommés** (`renamed:`) et quelques fichiers **modifiés**. Ouvre dans VS Code le `git diff` de `Front_end/partage/js/session.js` et de `Front_end/partage/js/menu.js` : seules des adresses ont changé.

### 5 bis. Test de la phase 1

Lance `npm run dev` dans `Back_end`, puis ouvre chaque page dans le navigateur (Ctrl + F5), avec `F12` sur **Network** :

| # | Page | Résultat attendu |
|---|---|---|
| 1 | `http://localhost:3000/` | La page d'accueil et ses deux boutons de test fonctionnent |
| 2 | `/connexion/connexion.html` | Formulaire, menu de visiteur |
| 3 | `/inscription/inscription.html` | Formulaire, choix Client / Commerçant |
| 4 | `/etablissements/liste-etablissements.html` | Liste des boutiques, filtres |
| 5 | Clic sur une boutique | `/etablissements/fiche-etablissement.html?id=...`, produits |
| 6 | Connecté en client : `/panier/panier.html` | Panier, adresse, boutons |
| 7 | `/commandes/mes-commandes.html`, puis clic sur une commande | Historique, puis `/commandes/suivi-commande.html?id=...` |
| 8 | Connecté en commerçant | Arrivée directe sur `/commercant/tableau-de-bord/tableau-de-bord.html`, liste et détail |
| 9 | Menu, dans chaque rôle | Tous les liens existants mènent à une page. « Historique », « Ma boutique » et « Produits » du commerçant donnent `Cannot GET` : leurs pages arrivent aux étapes 33 et 34 |
| 10 | Déconnecté, ouvre `/panier/panier.html` | Renvoi vers `/connexion/connexion.html?retour=%2Fpanier%2Fpanier.html`, puis retour sur le panier après connexion |

Dans **Network**, **aucune** requête ne doit répondre `404`, à part `favicon.ico`. Dans la **Console**, aucune erreur `Failed to resolve import` ni `Refused to ...`.

Pour la phase 1, l'allure des pages est **identique** à avant : le CSS n'a pas encore été touché.

Si tout est bon, enregistre cette phase :

```powershell
git add -A Front_end tests-api
git commit -m "refactor(front): rangement par dossiers de fonctionnalite"
```

Ne commite **pas** `rangement-front.ps1` : il ne sert qu'une fois. Supprime-le :

```powershell
Remove-Item rangement-front.ps1
```

---

## Phase 2 : un fichier CSS par dossier

Le gros `style.css` est coupé en deux : ce qui sert à plusieurs pages reste dans `partage/css/style.css`, ce qui ne sert qu'à une page va dans le `.css` de son dossier. L'allure des pages **ne doit pas changer**.

### 1. `Front_end/partage/css/style.css` : remplacer tout le fichier

```css
/* ===== Variables : couleurs et mesures au même endroit ===== */

/*
  🔧 À MODIFIER : pour changer l'allure du site, change ces valeurs.
  L'accent (--accent) sert en FOND de boutons et de pastilles, avec du texte foncé
  dessus. En texte sur fond clair, il serait illisible.
*/
:root {
  --fond: #E5E6E1;
  --carte: #FFFFFF;
  --accent: #15E2B6;
  --accent-survol: #10C9A2;
  --texte: #1B2420;
  --texte-doux: #4A5550;
  --texte-sur-accent: #10231E;
  --bordure: #8E9388;
  --trait: #D4D6CF;

  --erreur-fond: #FDECEA;
  --erreur-texte: #7A1C1C;
  --erreur-bordure: #E8A9A3;
  --ok-fond: #D3F8EE;
  --ok-texte: #0B3B30;

  --rayon: 14px;
}


/* ===== Base ===== */

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--fond);
  color: var(--texte);
  font: 16px/1.5 system-ui, "Segoe UI", sans-serif;
}

h1,
h2 {
  margin: 0 0 8px;
}

a {
  color: var(--texte-sur-accent);
}

/* Anneau de focus visible au clavier */
:focus-visible {
  outline: 3px solid var(--texte);
  outline-offset: 2px;
}

/* L'attribut hidden doit toujours gagner sur les autres règles d'affichage */
[hidden] {
  display: none !important;
}


/* ===== Structure ===== */

.entete {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--carte);
}

.marque {
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--texte-sur-accent);
  font-weight: 700;
  text-decoration: none;
}

.conteneur {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px;
}

.carte {
  margin-bottom: 16px;
  padding: 16px;
  border-radius: var(--rayon);
  background: var(--carte);
}

.ligne {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.discret {
  color: var(--texte-doux);
  font-size: 14px;
}

/* Aligne les éléments d'une ligne à gauche */
.ligne-gauche {
  justify-content: flex-start;
}


/* ===== Boutons ===== */

.bouton {
  min-height: 46px;
  padding: 0 18px;
  border: 2px solid var(--accent);
  border-radius: 12px;
  background: var(--accent);
  color: var(--texte-sur-accent);
  font: 700 16px system-ui, sans-serif;
  cursor: pointer;
}

.bouton:hover {
  background: var(--accent-survol);
  border-color: var(--accent-survol);
}

.bouton-secondaire {
  background: transparent;
  border-color: var(--texte);
}

.bouton-secondaire:hover {
  background: var(--trait);
  border-color: var(--texte);
}

.bouton:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Un lien qui a l'allure d'un bouton */
.bouton-lien {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

/* Bouton qui a l'allure d'un lien (« Retirer », « Retour ») */
.lien-bouton {
  min-height: 44px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--texte);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}


/* ===== Formulaires ===== */

/* 16 px minimum : en dessous, certains téléphones zooment sur le champ */
.champ {
  display: block;
  width: 100%;
  min-height: 46px;
  margin: 4px 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--bordure);
  border-radius: 10px;
  background: var(--carte);
  color: var(--texte);
  font: 16px system-ui, sans-serif;
}

.conteneur-etroit {
  max-width: 460px;
}

.bouton-plein {
  width: 100%;
  margin-top: 8px;
}

.centre {
  text-align: center;
}

/* Case à cocher avec sa phrase, assez grande pour un doigt */
.case {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-bottom: 8px;
}

.case input {
  width: 20px;
  height: 20px;
}


/* ===== Pastilles, filtres ===== */

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 99px;
  background: var(--accent);
  color: var(--texte-sur-accent);
  font-size: 13px;
  font-weight: 700;
}

.badge-neutre {
  border: 1px solid var(--bordure);
  background: var(--carte);
  color: var(--texte);
}

.puce {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--texte);
  border-radius: 99px;
  background: transparent;
  color: var(--texte);
  font: 14px system-ui, sans-serif;
  cursor: pointer;
}

.puce[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--texte-sur-accent);
  font-weight: 700;
}

.filtres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 20px;
}


/* ===== Messages (erreurs, succès, informations) ===== */

.message {
  display: grid;
  gap: 4px;
  margin: 12px 0;
  padding: 12px 14px;
  border: 1px solid var(--trait);
  border-radius: 10px;
  background: var(--carte);
}

.message p {
  margin: 0;
}

.message-erreur {
  border-color: var(--erreur-bordure);
  background: var(--erreur-fond);
  color: var(--erreur-texte);
}

.message-ok {
  border-color: var(--accent);
  background: var(--ok-fond);
  color: var(--ok-texte);
}


/* ===== Accessibilité ===== */

/* Texte lu par les lecteurs d'écran, invisible à l'écran */
.cache-visuel {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}


/* ===== Menu principal ===== */

.menu {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.menu a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 4px;
}

/* La page où l'on se trouve est soulignée et en gras */
.menu a[aria-current="page"] {
  font-weight: 700;
  text-decoration: underline;
}

.menu .puce {
  min-height: 44px;
}

/* Un email long ne doit pas déformer l'en-tête */
.menu-email {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


/* ===== Composants utilisés par plusieurs pages ===== */

.lien-retour {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.carte-texte {
  flex: 1;
  min-width: 0;
}

.titre-carte {
  font-size: 18px;
  overflow-wrap: anywhere;
}

/* Description limitée à 3 lignes */
.carte-texte p {
  display: -webkit-box;
  margin: 6px 0 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* Liste de produits : fiche d'un établissement, suivi, tableau de bord */
.liste-produits {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Sur téléphone, les contrôles passent sous le nom du produit */
.produit {
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--trait);
}

.produit .carte-texte {
  flex: 1 1 180px;
}

.produit:last-child {
  border-bottom: 0;
}

.produit-nom {
  display: block;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.produit-description {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.prix {
  font-weight: 700;
  white-space: nowrap;
}

.total-panier {
  font-size: 20px;
}


/* ===== Boîtes de dialogue ===== */

dialog {
  width: calc(100% - 32px);
  max-width: 420px;
  padding: 20px;
  border: 0;
  border-radius: var(--rayon);
  background: var(--carte);
  color: var(--texte);
}

dialog::backdrop {
  background: rgba(27, 36, 32, 0.7);
}

.dialogue-actions {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.dialogue-entete {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dialogue-entete h2 {
  margin: 0;
}

.bouton-fermer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -8px -8px 0 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--texte);
  cursor: pointer;
}

.bouton-fermer:hover {
  background: var(--trait);
}
```

### 2. `Front_end/inscription/inscription.css` : créer

```css
/* ===== Inscription : choix Client / Commerçant ===== */

.choix-role {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
}

.choix-role legend {
  margin-bottom: 6px;
  padding: 0;
}

.option-role {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 12px;
  border: 2px solid var(--bordure);
  border-radius: 12px;
  cursor: pointer;
}

.option-role:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--texte-sur-accent);
  font-weight: 700;
}

.option-role:focus-within {
  outline: 3px solid var(--texte);
  outline-offset: 2px;
}
```

### 3. `Front_end/etablissements/etablissements.css` : créer

```css
/* ===== Liste des établissements ===== */

/* Grille responsive : autant de colonnes que la largeur le permet */
.grille {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.grille .carte {
  margin-bottom: 0;
}

.carte-boutique {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.vignette,
.vignette-vide {
  flex: none;
  width: 80px;
  height: 80px;
  border-radius: 10px;
  background: #C9CCC3;
}

.vignette {
  object-fit: cover;
}

.vignette-vide {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--texte-doux);
  font-size: 12px;
  text-align: center;
}


/* ===== Fiche d'un établissement ===== */

.bloc-banniere {
  margin-bottom: 12px;
}

.banniere,
.banniere-vide {
  display: block;
  width: 100%;
  height: 180px;
  border-radius: var(--rayon);
  background: #C9CCC3;
}

.banniere {
  object-fit: cover;
}

.banniere-vide {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--texte-doux);
}

.nom-boutique {
  overflow-wrap: anywhere;
}

/* Quantité et bouton « Ajouter » d'un produit */
.commande-produit {
  display: flex;
  align-items: center;
  gap: 8px;
}

.champ.quantite {
  width: 72px;
  margin: 0;
  padding: 0 8px;
  text-align: center;
}
```

### 4. `Front_end/panier/panier.css` : créer

```css
/* ===== Page du panier ===== */

.ligne-panier {
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--trait);
}

.ligne-panier:last-child {
  border-bottom: 0;
}

.ligne-panier .carte-texte {
  flex: 1 1 180px;
}

.quantite-controle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-quantite {
  width: 44px;
  min-height: 44px;
  border: 1px solid var(--texte);
  border-radius: 10px;
  background: var(--carte);
  color: var(--texte);
  font: 700 18px system-ui, sans-serif;
  cursor: pointer;
}

.btn-quantite:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.quantite-valeur {
  min-width: 2ch;
  font-weight: 700;
  text-align: center;
}

.badge-alerte {
  border: 1px solid var(--erreur-bordure);
  background: var(--erreur-fond);
  color: var(--erreur-texte);
}


/* ===== Commande : adresse de livraison ===== */

.bloc-commande {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--trait);
}

textarea.champ {
  min-height: 96px;
  resize: vertical;
}
```

### 5. `Front_end/commandes/commandes.css` : créer

```css
/* ===== Suivi d'une commande ===== */

/* Les quatre étapes du cycle de vie, en barres de progression */
.etapes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 16px 0 8px;
  padding: 0;
  list-style: none;
}

.etape {
  padding-top: 8px;
  border-top: 6px solid var(--trait);
  color: var(--texte-doux);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.etape-faite {
  border-top-color: var(--accent);
  color: var(--texte);
}

.etape-courante {
  border-top-color: var(--accent);
  color: var(--texte);
  font-weight: 700;
}

.actions-suivi {
  display: grid;
  gap: 8px;
  max-width: 420px;
  margin-top: 16px;
}

.actions-suivi p {
  margin: 0;
}
```

### 6. `Front_end/commercant/tableau-de-bord/tableau-de-bord.css` : créer

```css
/* ===== Tableau de bord du commerçant ===== */

h3 {
  margin: 16px 0 4px;
  font-size: 16px;
}

.tableau {
  display: grid;
  gap: 16px;
}

.panneau-liste,
.panneau-detail {
  min-width: 0;
}

/* Téléphone : on affiche la liste OU le détail */
.tableau:not(.detail-ouvert) .panneau-detail {
  display: none;
}

.tableau.detail-ouvert .panneau-liste {
  display: none;
}

/* Ordinateur : les deux panneaux côte à côte, le bouton retour n'a plus de raison d'être */
@media (min-width: 900px) {
  .tableau {
    grid-template-columns: 380px 1fr;
    align-items: start;
  }

  .tableau:not(.detail-ouvert) .panneau-detail,
  .tableau.detail-ouvert .panneau-liste {
    display: block;
  }

  .btn-retour-liste {
    display: none;
  }
}

.ligne-actualiser {
  justify-content: flex-start;
  margin-bottom: 12px;
}

/* Une commande de la liste : un bouton qui a l'allure d'une carte */
.carte-commande {
  display: block;
  width: 100%;
  margin-bottom: 12px;
  padding: 14px;
  border: 2px solid transparent;
  border-radius: var(--rayon);
  background: var(--carte);
  color: var(--texte);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.carte-commande:hover {
  border-color: var(--trait);
}

/* La commande ouverte : contour accent (et aria-current pour les lecteurs d'écran) */
.carte-commande[aria-current="true"] {
  border-color: var(--accent);
}

.ligne-texte {
  display: block;
  margin-top: 4px;
}

.actions-commande {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.actions-commande .bouton {
  flex: 1 1 200px;
}
```

### 7. Relier chaque page à son CSS

Dans le `<head>` de chaque page, **juste sous** la ligne `<link rel="stylesheet" href="/partage/css/style.css">`, ajoute :

| Page | Ligne à ajouter |
|---|---|
| `inscription/inscription.html` | `<link rel="stylesheet" href="/inscription/inscription.css">` |
| `etablissements/liste-etablissements.html` | `<link rel="stylesheet" href="/etablissements/etablissements.css">` |
| `etablissements/fiche-etablissement.html` | `<link rel="stylesheet" href="/etablissements/etablissements.css">` |
| `panier/panier.html` | `<link rel="stylesheet" href="/panier/panier.css">` |
| `commandes/suivi-commande.html` | `<link rel="stylesheet" href="/commandes/commandes.css">` |
| `commercant/tableau-de-bord/tableau-de-bord.html` | `<link rel="stylesheet" href="/commercant/tableau-de-bord/tableau-de-bord.css">` |

`connexion.html`, `mes-commandes.html` et `index.html` n'ont besoin d'aucun CSS en plus.

### 8. Test de la phase 2

Actualise chaque page avec `Ctrl + F5`. Elles doivent avoir **exactement la même allure** qu'avant. Regarde en particulier :

| # | Page | À vérifier |
|---|---|---|
| 1 | Connexion | Carte centrée, champs et bouton pleine largeur |
| 2 | Inscription | Choix Client / Commerçant côte à côte, la case cochée est verte |
| 3 | Liste des établissements | Cartes en grille, vignettes carrées, puces de filtre |
| 4 | Fiche d'un établissement | Bannière, produits avec leur prix et leur quantité, boîte de connexion pour un visiteur |
| 5 | Panier | Boutons − et +, badge « Indisponible » rouge, champ d'adresse haut de 3 lignes |
| 6 | Suivi d'une commande | Quatre barres d'étapes colorées selon le statut |
| 7 | Historique client | Cartes de commandes avec leur badge |
| 8 | Tableau de bord, ordinateur | Liste à gauche, détail à droite |
| 9 | Tableau de bord, largeur `390` | Liste seule, puis détail avec « ← Retour aux commandes » |
| 10 | Boîtes de dialogue (conflit, vidage, annulation, statut) | Croix en haut à droite, boutons pleine largeur |

Dans **Network**, les cinq nouveaux `.css` répondent `200`. Dans la **Console**, aucune erreur.

Si une page a perdu une partie de son style, regarde dans Network quel `.css` répond `404` : c'est la ligne `<link>` du tableau 7 qui est mal écrite. Si seul un élément a perdu son style, cherche sa classe avec `Ctrl + Shift + F` dans `Front_end` : elle doit exister dans exactement un `.css`.

Puis enregistre :

```powershell
git add -A Front_end
git commit -m "refactor(front): un fichier css par dossier de fonctionnalite"
```

---

## Terminer l'étape

Vérifie dans `git status` qu'il n'y a ni `rangement-front.ps1`, ni `.env`, ni `.db`, ni `uploads/`, ni `sauvegardes/`. Dans **Files changed** de la Pull Request, tu dois voir surtout des fichiers **renommés** (l'historique est conservé), et très peu de lignes modifiées.

```powershell
git push -u origin frontend-rangement
```

Dans la Pull Request, cherche `innerHTML`, `onclick` et `style="` : il ne doit toujours y en avoir aucun.

---

## Dépannage

| Problème | Cause probable et solution |
|---|---|
| Le script refuse de se lancer (« l'exécution de scripts est désactivée ») | Utilise exactement la commande `powershell -ExecutionPolicy Bypass -File .\rangement-front.ps1` |
| `git mv` échoue (« not under version control ») | Un fichier n'est pas encore enregistré dans Git : commite-le d'abord sur `main`, puis recommence sur une nouvelle branche |
| `Fichier introuvable : ...` | Le nom ne correspond pas à celui de ton dossier (par exemple `constantes.js` au lieu de `secteurs.js`). Corrige le nom dans la table `$deplacements` du script, après avoir fait `git switch main` puis `git branch -D frontend-rangement` si des fichiers ont déjà bougé |
| Page blanche, Console : `Failed to resolve import` | Un `import` pointe encore vers l'ancien dossier. Lance la 2e vérification de la phase 1 |
| `404` sur un `.js` ou un `.css` | Une ligne `<script src>` ou `<link href>` n'a pas été mise à jour. Lance la 1re vérification de la phase 1 |
| Renvoyé vers `/connexion.html` qui n'existe plus | Une adresse oubliée dans `api.js` ou `session.js` : cherche `connexion.html` avec `Ctrl + Shift + F` |
| Menu qui ne souligne plus la page courante | `menu.js` compare l'adresse de la page à celles du menu : une entrée n'a pas été mise à jour |
| L'allure d'une page a changé après la phase 2 | Un `<link>` du tableau 7 manque, ou une règle a été oubliée lors du copier-coller. Compare avec le bloc concerné |
| `rangement-front.ps1` apparaît dans `git status` | Supprime-le avant de commiter : `Remove-Item rangement-front.ps1` |

---

## À retenir

- **Déplacer un fichier change son adresse.** Pour le navigateur, un déplacement est un renommage : toutes les références doivent suivre, d'où le script et ses vérifications.
- **`git mv` garde l'historique** de chaque fichier. Une Pull Request de rangement montre donc surtout des fichiers « renommés », pas des suppressions et des créations.
- **Une règle simple pour s'y retrouver** : tout ce qui concerne une page est dans son dossier, tout ce qui sert à plusieurs pages est dans `partage/`.
- **Un rangement ne se mélange pas avec une nouvelle fonctionnalité.** On fait le rangement sur sa propre branche, on le teste, on le fusionne, puis on reprend le développement.
