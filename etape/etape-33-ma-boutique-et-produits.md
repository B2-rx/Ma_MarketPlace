# Étape 33 : Ma boutique et Produits (côté commerçant)

Objectif : le commerçant modifie sa boutique (nom, description, secteur, image) et gère son catalogue (ajouter, modifier, rendre indisponible, supprimer).
Le backend existe déjà : on ne touche à aucun fichier du Back_end.

---

## 0. Vérifications avant de coller (2 minutes)

Je n'ai pas sous les yeux le code de `api.js`, `outils.js`, `secteurs.js`, ni les réponses JSON exactes de tes routes. J'ai donc isolé tout ce que je suppose dans un bloc « RÉGLAGES À VÉRIFIER » en haut de chaque fichier JS. Vérifie ces points :

1. Dans `Back_end/tests-api/produits.http` : le corps du POST envoie-t-il le prix sous le nom `prix` ou `prixEntier` ? (réglage `CHAMP_PRIX`)
2. Dans `Back_end/tests-api/upload.http` : le champ du fichier s'appelle-t-il `image` ? (réglage `CHAMP_IMAGE`)
3. Dans PowerShell, à la racine du projet, affiche les fonctions partagées que j'utilise :

```powershell
Select-String -Path Front_end\partage\js\outils.js,Front_end\partage\js\secteurs.js,Front_end\partage\js\session.js -Pattern "export"
```

Je suppose : `afficherMessages(zone, liste, type)`, `pendant(bouton, fonctionAsync)`, `formaterPrix(entier)`, `urlImage(chemin)` (renvoie l'adresse ou null), `demanderConfirmation(message)` (renvoie une promesse vrai ou faux), `SECTEURS` (liste de textes ou d'objets), `lireUtilisateur()` (renvoie l'utilisateur ou null). Si une signature diffère, colle-moi les lignes affichées : je corrige avant que tu testes.

---

## 1. Branche Git

```powershell
git switch -c feat/ma-boutique-produits
```

Pourquoi : une branche par sujet. Si quelque chose casse, `main` reste propre.

---

## 2. Créer les dossiers et les fichiers

Dans `Front_end/commercant/`, à côté de `tableau-de-bord/` :

```
Front_end/commercant/ma-boutique/ma-boutique.html
Front_end/commercant/ma-boutique/ma-boutique.js
Front_end/commercant/ma-boutique/ma-boutique.css
Front_end/commercant/produits/produits.html
Front_end/commercant/produits/produits.js
Front_end/commercant/produits/produits.css
```

Ces adresses sont celles que `menu.js` attend déjà (`/commercant/ma-boutique/ma-boutique.html` et `/commercant/produits/produits.html`).

---

## 3. Page Ma boutique

### 3.1 `ma-boutique.html`

Pour ne pas casser la mise en page commune (en-tête, menu, CSP), on part d'une page qui marche :

1. Copie `commercant/tableau-de-bord/tableau-de-bord.html` vers `commercant/ma-boutique/ma-boutique.html`.
2. Change le `<title>` en `Ma boutique`.
3. Remplace le lien du CSS par `<link rel="stylesheet" href="/commercant/ma-boutique/ma-boutique.css">` (garde le lien vers `style.css`).
4. Remplace le script de la page par `<script type="module" src="/commercant/ma-boutique/ma-boutique.js"></script>` (garde le script `menu.js`).
5. Remplace tout le contenu de `<main>` par ceci :

```html
<main class="page-boutique">
  <h1>Ma boutique</h1>

  <!-- Zone où s'affichent les messages de succès et d'erreur -->
  <div id="messages"></div>

  <!-- Bloc 1 : informations texte -->
  <section class="carte">
    <h2>Informations</h2>
    <form id="formulaire-boutique" novalidate>
      <label for="champ-nom">Nom de la boutique</label>
      <input id="champ-nom" name="nom" type="text" maxlength="60" required>

      <label for="champ-secteur">Secteur</label>
      <select id="champ-secteur" name="secteur" required></select>

      <label for="champ-description">Description</label>
      <textarea id="champ-description" name="description" rows="5" maxlength="500"></textarea>
      <p class="aide"><span id="compteur">0</span> / 500 caractères</p>

      <button type="submit" class="bouton">Enregistrer</button>
    </form>
  </section>

  <!-- Bloc 2 : image (envoyée à part, car c'est un fichier) -->
  <section class="carte">
    <h2>Image</h2>
    <img id="apercu-image" class="apercu-image" alt="Image de la boutique" hidden>
    <p id="sans-image">Aucune image pour le moment.</p>

    <form id="formulaire-image" novalidate>
      <label for="champ-fichier">Choisir une image (JPEG, PNG ou WebP, 2 Mo maximum)</label>
      <input id="champ-fichier" type="file" accept="image/jpeg,image/png,image/webp">
      <button type="submit" class="bouton">Envoyer l'image</button>
    </form>
  </section>
</main>
```

Si le style d'un bouton ne ressemble pas aux autres pages, remplace la classe `bouton` par celle utilisée dans `connexion.html`.

### 3.2 `ma-boutique.js`

```js
/* ============================================================
   ma-boutique.js : page « Ma boutique » du commerçant
   Rôle : charger la boutique, l'enregistrer, envoyer son image.
   Le serveur reste le seul juge : les contrôles ci-dessous ne
   servent qu'à éviter un aller-retour inutile.
   ============================================================ */

/* ---- 1. IMPORTS : outils partagés (Front_end/partage/js) ---- */
import { appeler } from '/partage/js/api.js';
import { lireUtilisateur } from '/partage/js/session.js';
import { afficherMessages, pendant, urlImage } from '/partage/js/outils.js';
import { SECTEURS } from '/partage/js/secteurs.js';

/* ---- 2. RÉGLAGES À VÉRIFIER (voir étape 0) ----
   Les limites doivent rester identiques à Back_end/routes/boutiques.js.
   Si l'upload échoue avec une erreur 400 alors que le fichier est bon,
   vérifie d'abord CHAMP_IMAGE dans tests-api/upload.http. */
const CHAMP_IMAGE = 'image';
const NOM_MIN = 2;
const NOM_MAX = 60;
const DESCRIPTION_MAX = 500;
const TAILLE_IMAGE_MAX = 2 * 1024 * 1024; /* 2 Mo, comme multer côté serveur */
const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];

/* ---- 3. ÉLÉMENTS DE LA PAGE ---- */
const zoneMessages = document.getElementById('messages');
const formulaireBoutique = document.getElementById('formulaire-boutique');
const champNom = document.getElementById('champ-nom');
const champSecteur = document.getElementById('champ-secteur');
const champDescription = document.getElementById('champ-description');
const compteur = document.getElementById('compteur');
const formulaireImage = document.getElementById('formulaire-image');
const champFichier = document.getElementById('champ-fichier');
const apercu = document.getElementById('apercu-image');
const sansImage = document.getElementById('sans-image');

/* ---- 4. LECTURE DE LA RÉPONSE DU SERVEUR ----
   Seul endroit qui connaît les noms des champs JSON.
   À MODIFIER ici si ta réponse GET /api/boutiques/ma-boutique
   utilise d'autres noms (voir tests-api/boutiques.http). */
function lireBoutique(donnees) {
  const b = donnees?.boutique ?? donnees;
  return {
    nom: b?.nom ?? '',
    description: b?.description ?? '',
    secteur: b?.secteur ?? '',
    imageChemin: b?.imageChemin ?? b?.image_chemin ?? null,
  };
}

/* ---- 5. AFFICHAGE ---- */
function remplirSecteurs() {
  const vide = document.createElement('option');
  vide.value = '';
  vide.textContent = 'Choisir un secteur';
  champSecteur.append(vide);

  for (const s of SECTEURS) {
    /* Accepte une liste de textes ou une liste d'objets {valeur, libelle} */
    const option = document.createElement('option');
    option.value = typeof s === 'string' ? s : s.valeur;
    option.textContent = typeof s === 'string' ? s : s.libelle;
    champSecteur.append(option);
  }
}

function majCompteur() {
  compteur.textContent = String(champDescription.value.length);
}

/* Pas d'aperçu local avant l'envoi : la CSP stricte interdit les
   images « blob: ». On affiche l'image après l'envoi, depuis le serveur. */
function afficherImage(chemin) {
  const adresse = chemin ? urlImage(chemin) : null;
  if (adresse) {
    apercu.src = adresse;
    apercu.hidden = false;
    sansImage.hidden = true;
  } else {
    apercu.hidden = true;
    sansImage.hidden = false;
  }
}

/* ---- 6. CHARGEMENT ---- */
async function chargerBoutique() {
  const r = await appeler('GET', '/api/boutiques/ma-boutique');
  if (r.statut === 404) return; /* pas encore de boutique : formulaire vide */
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  const b = lireBoutique(r.donnees);
  champNom.value = b.nom;
  champSecteur.value = b.secteur;
  champDescription.value = b.description;
  majCompteur();
  afficherImage(b.imageChemin);
}

/* ---- 7. ENREGISTRER LES INFORMATIONS ---- */
function verifierBoutique(corps) {
  const erreurs = [];
  if (corps.nom.length < NOM_MIN || corps.nom.length > NOM_MAX) {
    erreurs.push(`Le nom doit contenir de ${NOM_MIN} à ${NOM_MAX} caractères.`);
  }
  if (!corps.secteur) erreurs.push('Choisissez un secteur.');
  if (corps.description.length > DESCRIPTION_MAX) {
    erreurs.push(`La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`);
  }
  return erreurs;
}

formulaireBoutique.addEventListener('submit', async (evenement) => {
  evenement.preventDefault(); /* empêche le rechargement de la page */

  const corps = {
    nom: champNom.value.trim(),
    description: champDescription.value.trim(),
    secteur: champSecteur.value,
  };
  const erreurs = verifierBoutique(corps);
  if (erreurs.length > 0) {
    afficherMessages(zoneMessages, erreurs, 'erreur');
    return;
  }

  const bouton = formulaireBoutique.querySelector('button[type="submit"]');
  await pendant(bouton, async () => {
    const r = await appeler('PUT', '/api/boutiques/ma-boutique', corps);
    if (r.ok) afficherMessages(zoneMessages, ['Boutique enregistrée.'], 'succes');
    else afficherMessages(zoneMessages, r.erreurs, 'erreur');
  });
});

/* ---- 8. ENVOYER L'IMAGE ----
   Un fichier part en « multipart/form-data » (FormData), pas en JSON.
   On utilise fetch directement, SANS écrire l'en-tête Content-Type :
   le navigateur le fabrique lui-même avec la bonne « frontière ».
   Les cookies de session partent automatiquement (même origine). */
formulaireImage.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();

  const fichier = champFichier.files[0];
  if (!fichier) {
    afficherMessages(zoneMessages, ['Choisissez un fichier.'], 'erreur');
    return;
  }
  if (!TYPES_IMAGE.includes(fichier.type)) {
    afficherMessages(zoneMessages, ['Format accepté : JPEG, PNG ou WebP.'], 'erreur');
    return;
  }
  if (fichier.size > TAILLE_IMAGE_MAX) {
    afficherMessages(zoneMessages, ['Image trop lourde (2 Mo maximum).'], 'erreur');
    return;
  }

  const donnees = new FormData();
  donnees.append(CHAMP_IMAGE, fichier);

  const bouton = formulaireImage.querySelector('button[type="submit"]');
  await pendant(bouton, async () => {
    const reponse = await fetch('/api/boutiques/ma-boutique/image', {
      method: 'POST',
      body: donnees,
      cache: 'no-store',
    });

    if (reponse.ok) {
      champFichier.value = '';
      afficherMessages(zoneMessages, ['Image enregistrée.'], 'succes');
      await chargerBoutique(); /* recharge pour afficher la nouvelle image */
      return;
    }

    /* Messages selon le code : le serveur vérifie la vraie signature du fichier */
    let message = "L'envoi a échoué. Réessayez.";
    if (reponse.status === 401) {
      location.href = '/connexion/connexion.html?retour=' + encodeURIComponent(location.pathname);
      return;
    }
    if (reponse.status === 413) message = 'Image trop lourde (2 Mo maximum).';
    else if (reponse.status === 400) message = "Image refusée : utilisez un vrai fichier JPEG, PNG ou WebP.";
    else if (reponse.status === 404) message = "Enregistrez d'abord les informations de la boutique.";
    afficherMessages(zoneMessages, [message], 'erreur');
  });
});

/* ---- 9. DÉMARRAGE ---- */
async function demarrer() {
  const utilisateur = await lireUtilisateur();
  if (!utilisateur) {
    location.href = '/connexion/connexion.html?retour=' + encodeURIComponent(location.pathname);
    return;
  }
  if (utilisateur.role !== 'commercant') {
    location.href = '/etablissements/liste-etablissements.html';
    return;
  }
  remplirSecteurs();
  champDescription.addEventListener('input', majCompteur);
  await chargerBoutique();
}

demarrer();
```

### 3.3 `ma-boutique.css`

```css
/* ============================================================
   ma-boutique.css : styles propres à la page Ma boutique
   Les couleurs de base viennent de partage/css/style.css.
   ============================================================ */

.page-boutique {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
}

/* Espace entre les champs du formulaire */
.page-boutique label {
  display: block;
  margin: 16px 0 6px;
  font-weight: 600;
}

.page-boutique input[type="text"],
.page-boutique select,
.page-boutique textarea {
  width: 100%;
  min-height: 44px; /* cible tactile confortable */
  padding: 8px 12px;
  box-sizing: border-box;
}

.page-boutique .aide {
  margin: 4px 0 16px;
  font-size: 0.9rem;
}

/* Aperçu de l'image : jamais plus large que la carte */
.apercu-image {
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin-bottom: 12px;
  border-radius: 12px;
  object-fit: cover;
}
```

---

## 4. Page Produits

### 4.1 `produits.html`

Même méthode : copie `tableau-de-bord.html` vers `commercant/produits/produits.html`, change le `<title>` en `Mes produits`, pointe le CSS vers `/commercant/produits/produits.css` et le script vers `/commercant/produits/produits.js`, puis remplace le contenu de `<main>` :

```html
<main class="page-produits">
  <h1>Mes produits</h1>
  <div id="messages"></div>

  <!-- Formulaire unique : sert à ajouter ET à modifier -->
  <section class="carte">
    <h2 id="titre-formulaire">Ajouter un produit</h2>
    <form id="formulaire-produit" novalidate>
      <label for="champ-nom">Nom</label>
      <input id="champ-nom" type="text" maxlength="80" required>

      <label for="champ-prix">Prix en FCFA (nombre entier)</label>
      <input id="champ-prix" type="text" inputmode="numeric" autocomplete="off" required>

      <label for="champ-description">Description (facultative)</label>
      <textarea id="champ-description" rows="3" maxlength="300"></textarea>

      <label class="ligne-case">
        <input id="champ-disponible" type="checkbox" checked>
        Disponible à la commande
      </label>

      <button type="submit" id="bouton-enregistrer" class="bouton">Ajouter</button>
      <button type="button" id="bouton-annuler" class="bouton" hidden>Annuler la modification</button>
    </form>
  </section>

  <!-- Liste du catalogue : remplie par produits.js -->
  <section>
    <h2>Mon catalogue</h2>
    <p id="liste-vide" hidden>Aucun produit pour le moment.</p>
    <ul id="liste-produits" class="liste-produits"></ul>
  </section>
</main>
```

### 4.2 `produits.js`

```js
/* ============================================================
   produits.js : gestion du catalogue du commerçant
   Routes utilisées : GET, POST /api/produits ; PUT, DELETE /api/produits/:id
   Tout texte venant du serveur passe par textContent (jamais innerHTML),
   donc un nom de produit « <b>x</b> » s'affiche tel quel, sans effet.
   ============================================================ */

/* ---- 1. IMPORTS ---- */
import { appeler } from '/partage/js/api.js';
import { lireUtilisateur } from '/partage/js/session.js';
import { afficherMessages, pendant, formaterPrix, demanderConfirmation } from '/partage/js/outils.js';

/* ---- 2. RÉGLAGES À VÉRIFIER (voir étape 0) ----
   Les limites doivent rester identiques à Back_end/routes/produits.js.
   CHAMP_PRIX : nom du champ du prix dans le corps JSON (tests-api/produits.http). */
const CHAMP_PRIX = 'prix';
const NOM_MIN = 2;
const NOM_MAX = 80;
const DESCRIPTION_MAX = 300;
const PRIX_MAX = 10000000;

/* ---- 3. ÉLÉMENTS DE LA PAGE ET ÉTAT ---- */
const zoneMessages = document.getElementById('messages');
const formulaire = document.getElementById('formulaire-produit');
const titreFormulaire = document.getElementById('titre-formulaire');
const champNom = document.getElementById('champ-nom');
const champPrix = document.getElementById('champ-prix');
const champDescription = document.getElementById('champ-description');
const champDisponible = document.getElementById('champ-disponible');
const boutonEnregistrer = document.getElementById('bouton-enregistrer');
const boutonAnnuler = document.getElementById('bouton-annuler');
const listeProduits = document.getElementById('liste-produits');
const listeVide = document.getElementById('liste-vide');

let produits = []; /* copie locale de la liste affichée */
let idEnEdition = null; /* null = mode ajout ; un nombre = mode modification */

/* ---- 4. LECTURE DES RÉPONSES ----
   À MODIFIER ici si les noms des champs JSON diffèrent. */
function lireProduit(p) {
  return {
    id: p.id,
    nom: p.nom,
    description: p.description ?? '',
    prix: p.prixEntier ?? p.prix_entier ?? p.prix,
    disponible: p.disponible === true || p.disponible === 1,
  };
}

/* ---- 5. AFFICHAGE DE LA LISTE ---- */
function creerBouton(texte, action) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton';
  bouton.textContent = texte;
  bouton.addEventListener('click', action);
  return bouton;
}

function creerLigne(produit) {
  const ligne = document.createElement('li');
  ligne.className = produit.disponible ? 'produit' : 'produit produit-indisponible';

  const infos = document.createElement('div');
  infos.className = 'produit-infos';

  const nom = document.createElement('h3');
  nom.textContent = produit.nom;

  const prix = document.createElement('p');
  prix.className = 'produit-prix';
  prix.textContent = formaterPrix(produit.prix);

  const etat = document.createElement('span');
  etat.className = 'pastille';
  etat.textContent = produit.disponible ? 'Disponible' : 'Indisponible';

  infos.append(nom, prix, etat);

  if (produit.description) {
    const description = document.createElement('p');
    description.textContent = produit.description;
    infos.append(description);
  }

  const actions = document.createElement('div');
  actions.className = 'produit-actions';
  actions.append(
    creerBouton('Modifier', () => commencerModification(produit)),
    creerBouton(produit.disponible ? 'Rendre indisponible' : 'Rendre disponible', () => basculerDisponibilite(produit)),
    creerBouton('Supprimer', () => supprimer(produit)),
  );

  ligne.append(infos, actions);
  return ligne;
}

function afficherListe() {
  listeProduits.replaceChildren(...produits.map(creerLigne));
  listeVide.hidden = produits.length > 0;
}

/* ---- 6. CHARGEMENT ---- */
async function chargerProduits() {
  const r = await appeler('GET', '/api/produits');
  if (r.statut === 404) {
    /* Pas de boutique : le serveur refuse le catalogue (chargerBoutique) */
    afficherMessages(zoneMessages, ["Créez d'abord votre boutique dans « Ma boutique »."], 'erreur');
    formulaire.hidden = true;
    return;
  }
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  const liste = Array.isArray(r.donnees) ? r.donnees : (r.donnees?.produits ?? []);
  produits = liste.map(lireProduit);
  afficherListe();
}

/* ---- 7. FORMULAIRE : mode ajout ou modification ---- */
function reinitialiserFormulaire() {
  idEnEdition = null;
  formulaire.reset();
  champDisponible.checked = true;
  titreFormulaire.textContent = 'Ajouter un produit';
  boutonEnregistrer.textContent = 'Ajouter';
  boutonAnnuler.hidden = true;
}

function commencerModification(produit) {
  idEnEdition = produit.id;
  champNom.value = produit.nom;
  champPrix.value = String(produit.prix);
  champDescription.value = produit.description;
  champDisponible.checked = produit.disponible;
  titreFormulaire.textContent = 'Modifier le produit';
  boutonEnregistrer.textContent = 'Enregistrer les modifications';
  boutonAnnuler.hidden = false;
  formulaire.scrollIntoView({ behavior: 'smooth' });
  champNom.focus();
}

boutonAnnuler.addEventListener('click', reinitialiserFormulaire);

/* Contrôle de confort : le serveur refait les mêmes vérifications */
function verifierProduit(corps) {
  const erreurs = [];
  if (corps.nom.length < NOM_MIN || corps.nom.length > NOM_MAX) {
    erreurs.push(`Le nom doit contenir de ${NOM_MIN} à ${NOM_MAX} caractères.`);
  }
  if (corps.description.length > DESCRIPTION_MAX) {
    erreurs.push(`La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`);
  }
  if (typeof corps[CHAMP_PRIX] !== 'number' || corps[CHAMP_PRIX] > PRIX_MAX) {
    erreurs.push(`Le prix doit être un nombre entier de 0 à ${PRIX_MAX}.`);
  }
  return erreurs;
}

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();

  /* On accepte seulement des chiffres : « 12.5 », « -5 » et « abc » donnent NaN */
  const texteDuPrix = champPrix.value.trim();
  const corps = {
    nom: champNom.value.trim(),
    description: champDescription.value.trim(),
    [CHAMP_PRIX]: /^\d+$/.test(texteDuPrix) ? Number(texteDuPrix) : Number.NaN,
    disponible: champDisponible.checked,
  };

  const erreurs = verifierProduit(corps);
  if (erreurs.length > 0) {
    afficherMessages(zoneMessages, erreurs, 'erreur');
    return;
  }

  await pendant(boutonEnregistrer, async () => {
    const methode = idEnEdition === null ? 'POST' : 'PUT';
    const adresse = idEnEdition === null ? '/api/produits' : `/api/produits/${idEnEdition}`;
    const r = await appeler(methode, adresse, corps);
    if (!r.ok) {
      afficherMessages(zoneMessages, r.erreurs, 'erreur');
      return;
    }
    afficherMessages(zoneMessages, [idEnEdition === null ? 'Produit ajouté.' : 'Produit modifié.'], 'succes');
    reinitialiserFormulaire();
    await chargerProduits();
  });
});

/* ---- 8. BASCULER LA DISPONIBILITÉ ----
   On renvoie le produit complet avec « disponible » inversé
   (le PUT du serveur valide tous les champs). */
async function basculerDisponibilite(produit) {
  const corps = {
    nom: produit.nom,
    description: produit.description,
    [CHAMP_PRIX]: produit.prix,
    disponible: !produit.disponible,
  };
  const r = await appeler('PUT', `/api/produits/${produit.id}`, corps);
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  await chargerProduits();
}

/* ---- 9. SUPPRIMER ----
   Les commandes déjà passées gardent leur historique : nom et prix y sont copiés. */
async function supprimer(produit) {
  const confirme = await demanderConfirmation(`Supprimer « ${produit.nom} » du catalogue ?`);
  if (!confirme) return;

  const r = await appeler('DELETE', `/api/produits/${produit.id}`);
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  if (idEnEdition === produit.id) reinitialiserFormulaire();
  afficherMessages(zoneMessages, ['Produit supprimé.'], 'succes');
  await chargerProduits();
}

/* ---- 10. DÉMARRAGE ---- */
async function demarrer() {
  const utilisateur = await lireUtilisateur();
  if (!utilisateur) {
    location.href = '/connexion/connexion.html?retour=' + encodeURIComponent(location.pathname);
    return;
  }
  if (utilisateur.role !== 'commercant') {
    location.href = '/etablissements/liste-etablissements.html';
    return;
  }
  await chargerProduits();
}

demarrer();
```

### 4.3 `produits.css`

```css
/* ============================================================
   produits.css : styles propres à la page Produits
   ============================================================ */

.page-produits {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}

.page-produits label {
  display: block;
  margin: 16px 0 6px;
  font-weight: 600;
}

.page-produits input[type="text"],
.page-produits textarea {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  box-sizing: border-box;
}

/* La case à cocher et son texte sur une même ligne */
.ligne-case {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}

.liste-produits {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

/* Une carte blanche par produit */
.produit {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

/* Produit indisponible : légèrement estompé */
.produit-indisponible {
  opacity: 0.7;
}

.produit-prix {
  font-weight: 700;
}

.pastille {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  background: #15E2B6; /* accent du projet, texte foncé */
  color: #1b1b1b;
  font-size: 0.85rem;
}

.produit-indisponible .pastille {
  background: #d9d9d4;
}

.produit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.produit-actions .bouton {
  min-height: 44px;
}
```

---

## 5. Tests de vérification (serveur lancé : `npm run dev` dans Back_end)

Connecte-toi avec `boulangerie@example.com` dans une fenêtre normale, et utilise une fenêtre privée pour les tests côté client.

1. Menu commerçant, lien « Ma boutique » : la page affiche Boulangerie du Coin avec son secteur et sa description.
2. Change la description, clique Enregistrer : message de succès. Actualise la page (F5) : la nouvelle description est là.
3. Mets un nom d'un seul caractère : message d'erreur et aucune requête dans F12, onglet Network.
4. Envoie `tests-api/images-test/faux.png` : refusé (message). Envoie `boulangerie.webp` : l'aperçu apparaît. Vérifie que l'ancien fichier a disparu de `Back_end/uploads/`.
5. Tape `<b>test</b>` dans la description et enregistre : le texte s'affiche tel quel, sans gras.
6. Menu, lien « Produits » : Baguette 150 FCFA et Croissant 300 FCFA sont listés.
7. Ajoute « Pain au chocolat » à 250 : il apparaît. Essaie le prix `12.5`, puis `-5` : refusés avant tout envoi.
8. Clique Modifier sur le pain au chocolat, passe le prix à 275, enregistre : la liste est à jour et le formulaire repasse en mode « Ajouter ».
9. Clique « Rendre indisponible », puis ouvre la fiche de la boutique dans la fenêtre privée : le produit n'y est plus.
10. Supprime le pain au chocolat : confirmation demandée, puis il disparaît.
11. Connecte-toi en `alice@example.com` (client) et ouvre `/commercant/produits/produits.html` : tu es redirigé vers la liste des établissements.

Si tu modifies un fichier déjà validé (par exemple pour adapter une signature), rejoue les tests de la page concernée.

---

## 6. Dépannage (cas probables)

- Page blanche, erreur rouge « does not provide an export named ... » dans la console F12 : une fonction importée n'existe pas sous ce nom dans `outils.js`, `session.js` ou `secteurs.js`. Reprends la sortie de la commande de l'étape 0.
- Le menu ou le style de la page est absent : tu as oublié de garder le `<head>` ou le script `menu.js` en copiant `tableau-de-bord.html`.
- Ajout de produit refusé en 400 alors que tout est rempli : le nom du champ du prix est faux, corrige `CHAMP_PRIX`.
- Envoi d'image refusé en 400 avec un vrai fichier : corrige `CHAMP_IMAGE`.
- Liste de produits vide alors que la base en contient : la forme de la réponse diffère, regarde l'onglet Network (réponse de `GET /api/produits`) et adapte `lireProduit` ou la ligne `liste`.
- Page produits sans boutique créée (compte `commercant@example.com`) : le message « Créez d'abord votre boutique » est normal.

---

## 7. Pourquoi ces choix

- Le contrôle côté navigateur n'est qu'un confort : le serveur revalide tout (type réel de l'image par signature, taille, prix entier, propriété du produit).
- Le fichier image est envoyé séparément du texte : un fichier ne tient pas dans du JSON, et ça permet de limiter la taille et le type côté serveur.
- Pas d'aperçu avant envoi : la CSP du projet n'autorise que les images venant du site lui-même.
- La suppression d'un produit ne casse pas l'historique : les lignes de commande ont copié le nom et le prix.
- Aucun `innerHTML` : tout passe par `textContent`.

## 8. Git

Commits suggérés : `feat(frontend): page ma boutique et envoi d'image`, puis `feat(frontend): page de gestion des produits`. Avant chaque commit, `git status` ne doit montrer ni `.env`, ni `.db`, ni `uploads/`.

Quand les tests 1 à 11 sont bons, écris-moi leurs résultats (par exemple « 1 à 10 = ok, 11 = redirigé ») et je passe à l'étape 34 (historique commerçant).
