# Jour 4, Étape 30 : La commande côté client

## Ce qu'on construit

| Page | Rôle |
|---|---|
| `panier.html` (modifiée) | Adresse de livraison et bouton **Commander** |
| `suivi-commande.html` (nouvelle) | Statut, étapes, bouton **Rafraîchir**, bouton **Annuler** (grisé quand ce n'est plus possible) |
| `mes-commandes.html` (nouvelle) | Historique du client |

Le backend ne change pas. Le serveur envoie déjà `statutLibelle`, `annulable` et `annulePar` : les pages n'ont aucune règle à connaître.

## Fichiers de l'étape

| Fichier | Action |
|---|---|
| `Front_end/css/style.css` | Ajout à la fin (section 2) |
| `Front_end/js/validation.js` | Ajout à la fin (section 3) |
| `Front_end/panier.html` | **Remplacer** (section 4) |
| `Front_end/js/page-panier.js` | **Remplacer** (section 5) |
| `Front_end/suivi-commande.html` | Créer (section 6) |
| `Front_end/js/page-suivi-commande.js` | Créer (section 7) |
| `Front_end/mes-commandes.html` | Créer (section 8) |
| `Front_end/js/page-mes-commandes.js` | Créer (section 9) |
| `tests-api/frontend-commande.http` | Créer (section 10) |

Aucun nom ne ressemble à un autre : `suivi-commande` (une commande) et `mes-commandes` (la liste) restent bien distincts.

## Protections de l'étape

| Risque | Protection |
|---|---|
| Un prix ou un total envoyé par la page | Seule l'adresse part : tout le reste vient du panier côté serveur |
| Adresse vide, trop courte ou piégée | Contrôle dans la page (confort), puis revérification par le serveur |
| Double clic qui envoie deux commandes | Bouton désactivé pendant l'envoi (`pendant`) |
| Commande avec un produit passé en rupture | Le serveur répond `409` : la page relit le panier et nomme les produits |
| Adresse ou nom de produit contenant du code | `textContent` uniquement |
| Lecture de la commande d'un autre client | Le serveur répond `404` (filtre sur le propriétaire). La page affiche « Commande introuvable. » |
| Annulation tardive (la commande a avancé entre-temps) | Le serveur refuse (`409`), la page se rafraîchit et grise le bouton |
| Annulation par erreur | Boîte de confirmation avec croix |
| Adresse mémorisée dans le navigateur | Rien n'est stocké : ni `localStorage`, ni cookie |

---

## 1. Créer la branche

```powershell
git switch main
git pull
git switch -c frontend-commande
```

---

## 2. `Front_end/css/style.css` : ajouter à la fin

```css
/* ===== Commande : formulaire du panier ===== */

.bloc-commande {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--trait);
}

textarea.champ {
  min-height: 96px;
  resize: vertical;
}


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

---

## 3. `Front_end/js/validation.js` : ajouter à la fin

```javascript
/* ===== Adresse de livraison ===== */

/*
  ⚠️ Doivent rester identiques à ADRESSE_MIN et ADRESSE_MAX dans
  Back_end/constantes.js.
*/
export const ADRESSE_MIN = 10;
export const ADRESSE_MAX = 200;

/*
  Nettoie l'adresse saisie : renvoie le texte propre, ou null si elle est invalide.
  Mêmes règles que le serveur, qui revérifie de toute façon.
*/
export function nettoyerAdresse(valeur) {
  /*
    Retours à la ligne, tabulations et espaces multiples deviennent
    UN seul espace : "12 rue X\n75011 Paris" devient "12 rue X 75011 Paris".
  */
  const adresse = valeur.replace(/\s+/g, ' ').trim();

  if (adresse.length < ADRESSE_MIN || adresse.length > ADRESSE_MAX) {
    return null;
  }

  // Il ne doit rester aucun caractère de contrôle (cloche, caractère nul...)
  if (/[\u0000-\u001F\u007F]/.test(adresse)) {
    return null;
  }

  return adresse;
}
```

---

## 4. `Front_end/panier.html` : remplacer tout le fichier

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mon panier · Ma MarketPlace</title>
  <link rel="stylesheet" href="/css/style.css">
  <script type="module" src="/js/menu.js"></script>
  <script type="module" src="/js/page-panier.js"></script>
</head>

<body>
  <header class="entete">
    <a class="marque" href="/">Ma MarketPlace</a>
    <nav id="menu" class="menu" aria-label="Navigation principale"></nav>
  </header>

  <main class="conteneur">
    <h1>Mon panier</h1>

    <div id="messages" class="message" tabindex="-1" hidden></div>

    <!-- Panier sans produit -->
    <section id="panier-vide" class="carte" hidden>
      <p>Ton panier est vide.</p>
      <a href="/liste-etablissements.html">Voir les établissements</a>
    </section>

    <!-- Panier rempli : cachée tant que rien n'est chargé -->
    <section id="panier-contenu" class="carte" hidden>
      <p class="discret">
        Établissement :
        <a id="nom-boutique" href="/liste-etablissements.html"></a>
      </p>

      <ul id="liste-panier" class="liste-produits"></ul>

      <div class="ligne">
        <strong>Total</strong>
        <strong id="total" class="total-panier"></strong>
      </div>

      <!-- Adresse de livraison et envoi de la commande -->
      <form id="formulaire-commande" class="bloc-commande" novalidate>
        <label for="adresse">Adresse de livraison</label>
        <textarea
          class="champ"
          id="adresse"
          name="adresse"
          rows="3"
          maxlength="200"
          autocomplete="street-address"
          aria-describedby="aide-adresse"
          required
        ></textarea>
        <p class="discret" id="aide-adresse">10 à 200 caractères : quartier, rue, repère.</p>

        <button class="bouton bouton-plein" id="commander" type="submit">Commander</button>
      </form>

      <button id="vider" class="bouton bouton-secondaire bouton-plein" type="button">Vider le panier</button>
    </section>
  </main>

  <!-- Confirmation avant de vider le panier -->
  <dialog id="dialogue-vider" aria-labelledby="titre-vider">
    <form method="dialog">
      <div class="dialogue-entete">
        <h2 id="titre-vider">Vider le panier ?</h2>

        <button class="bouton-fermer" value="non" aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <p>Tous les produits seront retirés.</p>

      <div class="dialogue-actions">
        <button class="bouton" value="oui">Vider le panier</button>
        <button class="bouton bouton-secondaire" value="non">Annuler</button>
      </div>
    </form>
  </dialog>
</body>
</html>
```

---

## 5. `Front_end/js/page-panier.js` : remplacer tout le fichier

```javascript
/* ===== page-panier.js : la page « Mon panier » ===== */
import { appeler } from './api.js';
import {
  afficherMessages,
  creerElement,
  demanderConfirmation,
  formaterPrix,
  pendant
} from './outils.js';
import { ADRESSE_MAX, ADRESSE_MIN, nettoyerAdresse } from './validation.js';

/* ⚠️ Doit rester identique à QUANTITE_MAX dans Back_end/routes/panier.js. */
const QUANTITE_MAX = 20;

const zoneMessages = document.getElementById('messages');
const blocVide = document.getElementById('panier-vide');
const blocContenu = document.getElementById('panier-contenu');
const lienBoutique = document.getElementById('nom-boutique');
const liste = document.getElementById('liste-panier');
const champTotal = document.getElementById('total');
const boutonVider = document.getElementById('vider');
const dialogueVider = document.getElementById('dialogue-vider');
const formulaireCommande = document.getElementById('formulaire-commande');
const champAdresse = document.getElementById('adresse');
const boutonCommander = document.getElementById('commander');

// Vrai si tous les produits du panier sont disponibles (information du serveur)
let commandable = false;


/* ===== Messages ===== */

// Affiche des erreurs et place le focus dessus (lu par les lecteurs d'écran)
function montrerErreurs(messages) {
  afficherMessages(zoneMessages, 'erreur', messages);
  zoneMessages.focus();
}


/* ===== Affichage ===== */

// Une ligne du panier : nom, prix, quantité modifiable, sous-total, « Retirer »
function creerLigne(ligne) {
  const element = creerElement('li', '', 'ligne-panier ligne');
  const texte = creerElement('div', '', 'carte-texte');

  texte.append(
    creerElement('span', ligne.nom, 'produit-nom'),
    creerElement('p', formaterPrix(ligne.prix) + " l'unité", 'discret produit-description')
  );

  // Produit passé en rupture depuis son ajout au panier
  if (!ligne.disponible) {
    texte.append(creerElement('span', 'Indisponible', 'badge badge-alerte'));
  }

  const moins = creerElement('button', '−', 'btn-quantite');
  const plus = creerElement('button', '+', 'btn-quantite');
  const controle = creerElement('div', '', 'quantite-controle');

  moins.type = 'button';
  plus.type = 'button';
  moins.setAttribute('aria-label', 'Retirer un exemplaire : ' + ligne.nom);
  plus.setAttribute('aria-label', 'Ajouter un exemplaire : ' + ligne.nom);

  // On ne descend pas sous 1 (pour supprimer, il y a « Retirer »)
  moins.disabled = ligne.quantite <= 1;
  plus.disabled = ligne.quantite >= QUANTITE_MAX;

  moins.addEventListener('click', () => {
    pendant(moins, () => changerQuantite(ligne, ligne.quantite - 1));
  });

  plus.addEventListener('click', () => {
    pendant(plus, () => changerQuantite(ligne, ligne.quantite + 1));
  });

  controle.append(moins, creerElement('span', String(ligne.quantite), 'quantite-valeur'), plus);

  const retirer = creerElement('button', 'Retirer', 'lien-bouton');

  retirer.type = 'button';
  retirer.setAttribute('aria-label', 'Retirer du panier : ' + ligne.nom);
  retirer.addEventListener('click', () => pendant(retirer, () => retirerLigne(ligne)));

  element.append(
    texte,
    controle,
    creerElement('span', formaterPrix(ligne.sousTotal), 'prix'),
    retirer
  );

  return element;
}

// Affiche le panier reçu du serveur (ou l'état « vide »)
function afficherPanier(panier) {
  if (panier.lignes.length === 0) {
    commandable = false;
    blocVide.hidden = false;
    blocContenu.hidden = true;
    return;
  }

  commandable = panier.commandable;

  blocVide.hidden = true;
  blocContenu.hidden = false;

  // L'identifiant est un entier fabriqué par le serveur
  lienBoutique.textContent = panier.boutique.nom;
  lienBoutique.href = '/fiche-etablissement.html?id=' + encodeURIComponent(panier.boutique.id);

  liste.replaceChildren();

  panier.lignes.forEach((ligne) => {
    liste.append(creerLigne(ligne));
  });

  champTotal.textContent = formaterPrix(panier.total);

  if (panier.commandable) {
    afficherMessages(zoneMessages, 'info', []);
  } else {
    afficherMessages(zoneMessages, 'erreur', [
      'Certains produits ne sont plus disponibles. Retire-les de ton panier pour pouvoir commander.'
    ]);
  }
}


/* ===== Chargement ===== */

/*
  Relit TOUT le panier sur le serveur. Après chaque action, on n'essaie pas de
  deviner le nouvel état : on l'affiche tel que le serveur le connaît.
  Un 401 (visiteur) renvoie vers la connexion, puis revient ici (api.js).
*/
async function charger() {
  const reponse = await appeler('GET', '/api/panier');

  if (!reponse.ok) {
    // Par exemple 403 pour un commerçant : le message vient du serveur
    blocVide.hidden = true;
    blocContenu.hidden = true;
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
    return;
  }

  afficherPanier(reponse.donnees.panier);
}


/* ===== Actions sur les lignes ===== */

// Fixe la quantité d'un produit (elle REMPLACE l'ancienne)
async function changerQuantite(ligne, quantite) {
  const reponse = await appeler(
    'PUT',
    '/api/panier/lignes/' + encodeURIComponent(ligne.produitId),
    { quantite }
  );

  await charger();

  if (!reponse.ok) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
  }
}

async function retirerLigne(ligne) {
  const reponse = await appeler(
    'DELETE',
    '/api/panier/lignes/' + encodeURIComponent(ligne.produitId)
  );

  await charger();

  if (!reponse.ok) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
  }
}

boutonVider.addEventListener('click', () => {
  pendant(boutonVider, async () => {
    const accepte = await demanderConfirmation(dialogueVider);

    if (!accepte) {
      return;
    }

    const reponse = await appeler('DELETE', '/api/panier');

    await charger();

    afficherMessages(
      zoneMessages,
      reponse.ok ? 'ok' : 'erreur',
      reponse.ok ? ['Panier vidé.'] : reponse.erreurs
    );
  });
});


/* ===== Passer la commande ===== */

/*
  Seule l'adresse part au serveur. Aucun prix, aucun total : il lit le panier
  enregistré chez lui et fait tous les calculs.
*/
formulaireCommande.addEventListener('submit', (evenement) => {
  // Empêche le navigateur de recharger la page : c'est notre code qui envoie
  evenement.preventDefault();

  pendant(boutonCommander, async () => {
    if (!commandable) {
      montrerErreurs(["Retire d'abord les produits indisponibles de ton panier."]);
      return;
    }

    const adresse = nettoyerAdresse(champAdresse.value);

    if (adresse === null) {
      montrerErreurs([
        `Adresse de livraison invalide (${ADRESSE_MIN} à ${ADRESSE_MAX} caractères, `
        + 'sans caractère de contrôle).'
      ]);
      champAdresse.focus();
      return;
    }

    const reponse = await appeler('POST', '/api/commandes', { adresseLivraison: adresse });

    // Commande créée (201) : on affiche son suivi
    if (reponse.ok) {
      window.location.href = '/suivi-commande.html?id='
        + encodeURIComponent(reponse.donnees.commande.id);
      return;
    }

    /*
      Refus (400, 409, 429...) : on relit le panier pour l'afficher à jour,
      puis on montre le message du serveur.
      409 : certains produits ne sont plus disponibles. Le serveur les nomme
      dans "indisponibles" ; ils s'affichent en texte, jamais en HTML.
    */
    await charger();

    const messages = [...reponse.erreurs];
    const indisponibles = reponse.donnees.indisponibles;

    if (Array.isArray(indisponibles) && indisponibles.length > 0) {
      const noms = indisponibles
        .map((produit) => produit.nom)
        .filter((nom) => typeof nom === 'string');

      messages.push('Produits concernés : ' + noms.join(', ') + '.');
    }

    montrerErreurs(messages);
  });
});

charger();
```

---

## 6. `Front_end/suivi-commande.html` : créer

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Suivi de commande · Ma MarketPlace</title>
  <link rel="stylesheet" href="/css/style.css">
  <script type="module" src="/js/menu.js"></script>
  <script type="module" src="/js/page-suivi-commande.js"></script>
</head>

<body>
  <header class="entete">
    <a class="marque" href="/">Ma MarketPlace</a>
    <nav id="menu" class="menu" aria-label="Navigation principale"></nav>
  </header>

  <main class="conteneur">
    <a class="lien-retour" href="/mes-commandes.html">← Mes commandes</a>

    <div id="messages" class="message" tabindex="-1" hidden></div>

    <!-- Cachée tant que la commande n'est pas chargée -->
    <article id="commande" class="carte" hidden>
      <h1>Commande n° <span id="numero"></span></h1>

      <p class="discret">
        Établissement :
        <a id="boutique" href="/liste-etablissements.html"></a>
      </p>

      <span id="statut" class="badge"></span>

      <!-- Les quatre étapes : remplies par le script -->
      <ol id="etapes" class="etapes" aria-label="Avancement de la commande"></ol>

      <!-- Annulée ou refusée : un message explique qui a fermé la commande -->
      <p id="info-statut" class="message" hidden></p>

      <p id="maj" class="discret"></p>

      <h2>Détail</h2>
      <ul id="lignes" class="liste-produits"></ul>

      <div class="ligne">
        <strong>Total</strong>
        <strong id="total" class="total-panier"></strong>
      </div>

      <h2>Livraison</h2>
      <p id="adresse"></p>

      <div class="actions-suivi">
        <button id="rafraichir" class="bouton" type="button">Rafraîchir le statut</button>

        <!-- Grisé quand la commande n'est plus annulable -->
        <button
          id="annuler"
          class="bouton bouton-secondaire"
          type="button"
          aria-describedby="aide-annulation"
        >Annuler la commande</button>

        <p id="aide-annulation" class="discret" hidden>Vous ne pouvez plus annuler cette commande.</p>
      </div>

      <!-- Lue par les lecteurs d'écran après chaque rafraîchissement -->
      <p id="verification" class="discret" role="status"></p>
    </article>
  </main>

  <!-- Confirmation avant d'annuler -->
  <dialog id="dialogue-annuler" aria-labelledby="titre-annuler">
    <form method="dialog">
      <div class="dialogue-entete">
        <h2 id="titre-annuler">Annuler la commande ?</h2>

        <button class="bouton-fermer" value="non" aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <p>Cette action est définitive.</p>

      <div class="dialogue-actions">
        <button class="bouton" value="oui">Annuler la commande</button>
        <button class="bouton bouton-secondaire" value="non">Garder ma commande</button>
      </div>
    </form>
  </dialog>
</body>
</html>
```

---

## 7. `Front_end/js/page-suivi-commande.js` : créer

```javascript
/* ===== page-suivi-commande.js : le suivi d'une commande ===== */
import { appeler } from './api.js';
import {
  afficherMessages,
  creerElement,
  demanderConfirmation,
  formaterDate,
  formaterPrix,
  pendant
} from './outils.js';


/* ===== Réglages ===== */

/*
  Les quatre étapes visibles du cycle de vie, dans l'ordre.
  Avant la première (« en attente »), aucune barre n'est colorée.
  🔧 À MODIFIER : pour changer un libellé d'étape, modifie ce tableau.
*/
const ETAPES = [
  { code: 'en_preparation', libelle: 'En préparation' },
  { code: 'prete', libelle: 'Prête' },
  { code: 'en_livraison', libelle: 'En livraison' },
  { code: 'terminee', libelle: 'Terminée' }
];

/*
  Statuts finaux : plus rien ne peut changer, le bouton « Annuler » disparaît.
  ⚠️ Doit rester identique à STATUTS_FINAUX dans Back_end/constantes.js.
*/
const STATUTS_FINAUX = ['terminee', 'annulee', 'refusee'];

// Statuts d'une commande fermée sans être livrée : badge neutre
const STATUTS_NEUTRES = ['annulee', 'refusee'];

const formatHeure = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });

const zoneMessages = document.getElementById('messages');
const fiche = document.getElementById('commande');
const champNumero = document.getElementById('numero');
const lienBoutique = document.getElementById('boutique');
const badgeStatut = document.getElementById('statut');
const zoneEtapes = document.getElementById('etapes');
const infoStatut = document.getElementById('info-statut');
const champMaj = document.getElementById('maj');
const listeLignes = document.getElementById('lignes');
const champTotal = document.getElementById('total');
const champAdresse = document.getElementById('adresse');
const boutonRafraichir = document.getElementById('rafraichir');
const boutonAnnuler = document.getElementById('annuler');
const aideAnnulation = document.getElementById('aide-annulation');
const champVerification = document.getElementById('verification');
const dialogueAnnuler = document.getElementById('dialogue-annuler');

// Vrai si le serveur autorise encore l'annulation (champ "annulable")
let annulable = false;


/* ===== Lecture de l'identifiant dans l'adresse ===== */

/*
  Renvoie l'identifiant (?id=12), ou null s'il est absent ou suspect.
  On n'accepte que des chiffres, sans zéro au début : l'identifiant est
  ensuite collé dans l'adresse de l'API.
*/
function lireId() {
  const id = new URLSearchParams(window.location.search).get('id');

  return id !== null && /^[1-9]\d{0,8}$/.test(id) ? id : null;
}

const id = lireId();


/* ===== Affichage ===== */

// Colore les barres d'étapes selon le statut (masquées si la commande est fermée)
function afficherEtapes(statut) {
  const position = ETAPES.findIndex((etape) => etape.code === statut);

  zoneEtapes.hidden = STATUTS_NEUTRES.includes(statut);
  zoneEtapes.replaceChildren();

  ETAPES.forEach((etape, index) => {
    const element = creerElement('li', etape.libelle, 'etape');

    if (index < position) {
      element.classList.add('etape-faite');
    }

    if (index === position) {
      element.classList.add('etape-courante');
      element.setAttribute('aria-current', 'step');
    }

    zoneEtapes.append(element);
  });
}

// Phrase qui explique qui a fermé la commande ("" si elle est en cours)
function lireInfoStatut(commande) {
  if (commande.statut === 'refusee') {
    return 'Le commerçant a refusé cette commande.';
  }

  if (commande.statut === 'annulee') {
    return commande.annulePar === 'commercant'
      ? 'Le commerçant a annulé cette commande.'
      : 'Tu as annulé cette commande.';
  }

  return '';
}

// Réapplique l'état du bouton « Annuler » (grisé si le serveur l'interdit)
function appliquerEtatAnnulation() {
  boutonAnnuler.disabled = !annulable;
}

// Affiche une commande reçue du serveur
function afficherCommande(commande) {
  const final = STATUTS_FINAUX.includes(commande.statut);
  const texteInfo = lireInfoStatut(commande);

  champNumero.textContent = String(commande.id);
  lienBoutique.textContent = commande.boutique.nom;
  lienBoutique.href = '/fiche-etablissement.html?id=' + encodeURIComponent(commande.boutique.id);

  // Le libellé vient du serveur : « En attente de validation du commerçant »...
  badgeStatut.textContent = commande.statutLibelle;
  badgeStatut.className = STATUTS_NEUTRES.includes(commande.statut) ? 'badge badge-neutre' : 'badge';

  afficherEtapes(commande.statut);

  infoStatut.textContent = texteInfo;
  infoStatut.hidden = texteInfo === '';

  champMaj.textContent = 'Passée le ' + formaterDate(commande.dateCreation)
    + ' · Dernière mise à jour : ' + formaterDate(commande.dateMiseAJour);

  listeLignes.replaceChildren();

  commande.lignes.forEach((ligne) => {
    const element = creerElement('li', '', 'produit ligne');
    const texte = creerElement('div', '', 'carte-texte');

    texte.append(
      creerElement('span', ligne.nom + ' × ' + ligne.quantite, 'produit-nom'),
      creerElement('p', formaterPrix(ligne.prix) + " l'unité", 'discret produit-description')
    );

    element.append(texte, creerElement('span', formaterPrix(ligne.sousTotal), 'prix'));
    listeLignes.append(element);
  });

  champTotal.textContent = formaterPrix(commande.total);
  champAdresse.textContent = commande.adresseLivraison;

  /*
    Scénario de Bernard :
      - en attente ou en préparation : le bouton est actif ;
      - prête ou en livraison : bouton grisé + message ;
      - commande terminée, annulée ou refusée : plus de bouton du tout.
  */
  annulable = commande.annulable;

  boutonAnnuler.hidden = final;
  aideAnnulation.hidden = final || commande.annulable;
  appliquerEtatAnnulation();

  fiche.hidden = false;
}


/* ===== Chargement ===== */

/*
  Relit la commande sur le serveur : c'est ce que fait le bouton « Rafraîchir ».
  api.js envoie la requête avec cache: 'no-store', donc la réponse est toujours
  à jour. Un autre client reçoit un 404 : « Commande introuvable. »
*/
async function charger() {
  if (id === null) {
    afficherMessages(zoneMessages, 'erreur', ['Commande introuvable.']);
    return;
  }

  const reponse = await appeler('GET', '/api/commandes/' + id);

  if (!reponse.ok) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
    return;
  }

  afficherMessages(zoneMessages, 'info', []);
  afficherCommande(reponse.donnees.commande);

  champVerification.textContent = 'Dernière vérification : ' + formatHeure.format(new Date());
}


/* ===== Annulation ===== */

async function annuler() {
  const accepte = await demanderConfirmation(dialogueAnnuler);

  if (!accepte) {
    return;
  }

  const reponse = await appeler('POST', '/api/commandes/' + id + '/annuler');

  /*
    200 : annulée. 409 : le statut a changé entre-temps (le commerçant a fait
    avancer la commande). Dans les deux cas, on relit l'état réel.
  */
  await charger();

  if (reponse.ok) {
    afficherMessages(zoneMessages, 'ok', ['Commande annulée.']);
  } else {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
  }
}

boutonRafraichir.addEventListener('click', () => {
  pendant(boutonRafraichir, charger);
});

boutonAnnuler.addEventListener('click', async () => {
  await pendant(boutonAnnuler, annuler);

  // pendant() réactive le bouton à la fin : on réapplique l'état du serveur
  appliquerEtatAnnulation();
});

charger();
```

---

## 8. `Front_end/mes-commandes.html` : créer

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mes commandes · Ma MarketPlace</title>
  <link rel="stylesheet" href="/css/style.css">
  <script type="module" src="/js/menu.js"></script>
  <script type="module" src="/js/page-mes-commandes.js"></script>
</head>

<body>
  <header class="entete">
    <a class="marque" href="/">Ma MarketPlace</a>
    <nav id="menu" class="menu" aria-label="Navigation principale"></nav>
  </header>

  <main class="conteneur">
    <h1>Mes commandes</h1>
    <p class="discret">Tes 50 dernières commandes, de la plus récente à la plus ancienne.</p>

    <div id="messages" class="message" tabindex="-1" hidden></div>

    <!-- Lu par les lecteurs d'écran pendant le chargement -->
    <p id="etat" class="discret" role="status"></p>

    <div id="liste"></div>
  </main>
</body>
</html>
```

---

## 9. `Front_end/js/page-mes-commandes.js` : créer

```javascript
/* ===== page-mes-commandes.js : l'historique du client ===== */
import { appeler } from './api.js';
import { afficherMessages, creerElement, formaterDate, formaterPrix } from './outils.js';

// Statuts d'une commande fermée sans être livrée : badge neutre
const STATUTS_NEUTRES = ['annulee', 'refusee'];

const zoneMessages = document.getElementById('messages');
const zoneEtat = document.getElementById('etat');
const zoneListe = document.getElementById('liste');


/* ===== Affichage ===== */

// Une carte de commande : lien vers son suivi, établissement, date, total, statut
function creerCarte(commande) {
  const carte = creerElement('article', '', 'carte ligne');
  const texte = creerElement('div', '', 'carte-texte');
  const titre = creerElement('h2', '', 'titre-carte');
  const lien = creerElement('a', 'Commande n° ' + commande.id);

  // L'identifiant est un entier fabriqué par le serveur
  lien.href = '/suivi-commande.html?id=' + encodeURIComponent(commande.id);
  titre.append(lien);

  texte.append(
    titre,
    creerElement('p', commande.boutique.nom, 'discret'),
    creerElement('p', formaterDate(commande.dateCreation) + ' · ' + formaterPrix(commande.total), 'discret')
  );

  const classe = STATUTS_NEUTRES.includes(commande.statut) ? 'badge badge-neutre' : 'badge';

  carte.append(texte, creerElement('span', commande.statutLibelle, classe));

  return carte;
}


/* ===== Chargement ===== */

async function charger() {
  zoneEtat.textContent = 'Chargement…';

  // Un 401 (session absente) renvoie vers la connexion, puis revient ici (api.js)
  const reponse = await appeler('GET', '/api/commandes');

  zoneEtat.textContent = '';

  if (!reponse.ok) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
    return;
  }

  const commandes = reponse.donnees.commandes;

  if (commandes.length === 0) {
    const vide = creerElement('p', "Tu n'as pas encore passé de commande. ");
    const lien = creerElement('a', 'Voir les établissements');

    lien.href = '/liste-etablissements.html';
    vide.append(lien);
    zoneListe.append(vide);
    return;
  }

  commandes.forEach((commande) => {
    zoneListe.append(creerCarte(commande));
  });
}

charger();
```

---

## 10. `tests-api/frontend-commande.http` : créer

Ces requêtes servent de **commerçant** : REST Client garde ses propres cookies, séparés de ceux du navigateur. Tu peux donc rester connecté en client dans le navigateur et faire avancer la commande avec REST Client.

```http
### Numéro de la commande à piloter (visible dans l'adresse du suivi : ?id=...)
@commandeId = 1

### 1. Page de suivi
GET http://localhost:3000/suivi-commande.html

### 2. Page de suivi, sans l'extension
GET http://localhost:3000/suivi-commande

### 3. Page de l'historique client
GET http://localhost:3000/mes-commandes

### 4. Module du suivi
GET http://localhost:3000/js/page-suivi-commande.js

### 5. Module de l'historique
GET http://localhost:3000/js/page-mes-commandes.js

### 6. Module du panier
GET http://localhost:3000/js/page-panier.js

### 7. Module de validation
GET http://localhost:3000/js/validation.js


### ===== LE COMMERÇANT (via REST Client) =====

### 8. Connexion de la boulangerie
POST http://localhost:3000/api/auth/connexion
Content-Type: application/json

{ "email": "boulangerie@example.com", "motDePasse": "Croissant2026" }

### 9. Accepter la commande
PATCH http://localhost:3000/api/commercant/commandes/{{commandeId}}/statut
Content-Type: application/json

{ "statut": "en_preparation" }

### 10. Prête
PATCH http://localhost:3000/api/commercant/commandes/{{commandeId}}/statut
Content-Type: application/json

{ "statut": "prete" }

### 11. En livraison
PATCH http://localhost:3000/api/commercant/commandes/{{commandeId}}/statut
Content-Type: application/json

{ "statut": "en_livraison" }

### 12. Terminée
PATCH http://localhost:3000/api/commercant/commandes/{{commandeId}}/statut
Content-Type: application/json

{ "statut": "terminee" }

### 13. Refuser (commande encore en attente)
PATCH http://localhost:3000/api/commercant/commandes/{{commandeId}}/statut
Content-Type: application/json

{ "statut": "refusee" }

### 14. Annuler (commande acceptée ou prête : rupture de stock)
PATCH http://localhost:3000/api/commercant/commandes/{{commandeId}}/statut
Content-Type: application/json

{ "statut": "annulee" }

### 15. Mettre le croissant (produit 2) en rupture
PUT http://localhost:3000/api/produits/2
Content-Type: application/json

{ "nom": "Croissant", "description": "", "prix": 300, "disponible": false }

### 16. Remettre le croissant disponible
PUT http://localhost:3000/api/produits/2
Content-Type: application/json

{ "nom": "Croissant", "description": "", "prix": 300, "disponible": true }

### 17. Déconnexion
POST http://localhost:3000/api/auth/deconnexion
```

Envoie les requêtes **1 à 7** : résultat attendu **200** partout.

---

## 11. Tests dans le navigateur

Chrome ou Edge, `F12` sur l'onglet **Network** puis **Console**. Reste connecté en **Alice** (client) dans le navigateur. Le commerçant se pilote avec les requêtes 8 à 17.

### A. Commander

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Ajoute 2 croissants à ton panier, ouvre `/panier.html` | Lignes, total, champ **Adresse de livraison**, bouton **Commander** |
| 2 | Clique sur **Commander**, adresse vide | Encadré rouge « Adresse de livraison invalide... », **aucune** requête `commandes` dans Network |
| 3 | Adresse `Rue 1` | Même message |
| 4 | Adresse `<b>12 rue</b> des Lilas, Abidjan` | La commande est créée, tu arrives sur `/suivi-commande.html?id=N`, et l'adresse s'affiche **avec les balises, sans gras** |
| 5 | Sur la page de suivi | Badge « En attente de validation du commerçant », 4 barres grises, total, adresse, bouton **Annuler** actif, **pas** de message sous les boutons |
| 6 | Ouvre **Panier** dans le menu | « Ton panier est vide. » |
| 7 | Nouveau panier, double clic rapide sur **Commander** | **Une seule** requête `commandes` (POST) dans Network |

### B. Suivre une commande (le scénario de Bernard)

Note le numéro N de ta dernière commande, mets-le dans `@commandeId`, puis connecte la boulangerie (requête 8).

| # | Action | Résultat attendu |
|---|---|---|
| 8 | **Rafraîchir le statut** sans rien changer | La ligne « Dernière vérification : HH:MM » se met à jour, rien d'autre ne bouge |
| 9 | Requête 9 (accepter), puis **Rafraîchir** | Badge « En préparation », première barre colorée, **Annuler toujours actif** |
| 10 | Requête 10 (prête), puis **Rafraîchir** | Badge « Prête à être livrée », deux barres colorées, bouton **Annuler grisé**, message « Vous ne pouvez plus annuler cette commande. » |
| 11 | Clique sur le bouton grisé | Rien ne se passe |
| 12 | Requêtes 11 et 12 (en livraison, terminée), **Rafraîchir** après chaque | Barres de plus en plus colorées. À « Terminée » : quatre barres, bouton **Annuler et message disparus** |

### C. Annuler

| # | Action | Résultat attendu |
|---|---|---|
| 13 | Nouvelle commande (en attente), clique sur **Annuler la commande** | La boîte s'ouvre : titre, croix, **Annuler la commande** et **Garder ma commande** |
| 14 | Clique sur la croix, puis `Échap` | La boîte se ferme, la commande est inchangée |
| 15 | Rouvre la boîte, clique sur **Annuler la commande** | « Commande annulée. », badge neutre « Annulée », texte « Tu as annulé cette commande. », barres masquées, plus de bouton Annuler |
| 16 | **Annulation tardive** : nouvelle commande, laisse la page ouverte. Requête 8 puis 9 puis 10 (prête). **Sans rafraîchir**, clique sur **Annuler** puis confirme | Message rouge « Vous ne pouvez plus annuler cette commande (statut : Prête à être livrée). », et la page se met à jour toute seule avec le bouton grisé |
| 17 | **Annulation par le commerçant** : nouvelle commande, requête 9 puis 14, puis **Rafraîchir** | Badge « Annulée », texte « Le commerçant a annulé cette commande. » |
| 18 | **Refus** : nouvelle commande, requête 13, puis **Rafraîchir** | Badge « Refusée par le commerçant », texte « Le commerçant a refusé cette commande. » |

### D. Les cas limites

| # | Action | Résultat attendu |
|---|---|---|
| 19 | Panier avec un croissant, requête 15 (rupture), **Commander** | Encadré rouge avec « Certains produits ne sont plus disponibles... » et « Produits concernés : Croissant. », badge **Indisponible** sur la ligne, aucune commande créée. Remets-le avec la requête 16 |
| 20 | Ouvre `/mes-commandes.html` | Cartes de la plus récente à la plus ancienne, avec date, total et statut. Un clic ouvre le suivi |
| 21 | Déconnecte-toi, connecte **Bob**, ouvre `/suivi-commande.html?id=1` | « Commande introuvable. » (jamais le contenu de la commande d'Alice) |
| 22 | `/suivi-commande.html?id=abc` et `/suivi-commande.html` | « Commande introuvable. » |
| 23 | Déconnecté, ouvre `/mes-commandes.html` | Redirection vers la connexion |
| 24 | Mode appareil, largeur `390` | Pas de défilement horizontal, quatre barres lisibles, boutons de 44 px, boîtes de dialogue dans l'écran |
| 25 | Console, sur chaque page | Aucune erreur `Refused to ...`. Le `401` de `/api/auth/moi` en visiteur est normal |

---

## Dépannage

| Problème | Cause probable et solution |
|---|---|
| Le bouton **Commander** ne fait rien | Console : `Failed to resolve import './validation.js'` ou `404` sur un `.js`. Compare les noms lettre par lettre. Vérifie aussi que le formulaire a `id="formulaire-commande"` |
| La page se recharge au clic sur **Commander** | `evenement.preventDefault()` manque, ou le script ne s'est pas chargé |
| `Cannot read properties of null` | Un `id` du HTML ne correspond pas à celui du script (`adresse`, `commander`, `formulaire-commande`) |
| Erreur `400` « Adresse de livraison invalide » alors que la page l'accepte | Le serveur n'est pas à jour (bornes `ADRESSE_MIN`/`ADRESSE_MAX`) : compare avec `Back_end/constantes.js` |
| `404` « Commande introuvable » sur ta propre commande | Mauvais `id` dans l'adresse, ou tu es connecté avec un autre compte |
| Le bouton **Annuler** reste actif après « Prête » | Tu n'as pas cliqué sur **Rafraîchir** : c'est le comportement prévu. Après un clic sur **Annuler**, le serveur refuse et la page se met à jour |
| Le bouton **Annuler** redevient actif après un refus | `appliquerEtatAnnulation()` manque après `await pendant(...)` dans l'écouteur de clic |
| Barres d'étapes toutes grises à « En préparation » | Les codes de `ETAPES` ne correspondent pas aux statuts du serveur (`en_preparation`, `prete`, `en_livraison`, `terminee`) |
| Les requêtes 9 à 14 répondent `401` ou `403` | REST Client n'est pas connecté en boulangerie : refais la requête 8. Un `404` signifie un mauvais `@commandeId` |
| Requête 9 ou 10 en `409` | La commande n'est pas dans le bon statut : regarde le message, chaque transition n'est autorisée que depuis certains statuts |
| `429` | Limiteur de commandes (20 par heure) ou de connexion : redémarre le serveur |
| Une mise en gras apparaît dans l'adresse | **Arrête-toi** : un `innerHTML` s'est glissé dans le code. Remplace-le par `textContent` |

---

## À retenir

- **Le serveur décide, la page affiche.** Le bouton **Annuler** est grisé parce que le serveur envoie `annulable: false`, pas parce que la page connaît la règle. Si elle change, seule `STATUTS_ANNULABLES_CLIENT` (backend) bouge.
- **Un rafraîchissement manuel est une simple relecture.** Aucune connexion permanente n'est nécessaire, comme prévu au cahier des charges.
- **Un refus du serveur n'est pas un échec** : le `409` d'annulation tardive prouve que deux acteurs peuvent agir en même temps, et que le résultat reste cohérent.
- **`pendant()` réactive le bouton à la fin.** Pour un bouton dont l'état dépend du serveur (grisé ou non), on réapplique cet état après coup.
- **Une adresse est une donnée personnelle.** Elle n'est affichée que dans le détail, jamais mémorisée dans le navigateur.
