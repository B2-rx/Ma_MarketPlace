# Jour 4, Étape 31 : Le tableau de bord du commerçant

## Ce qu'on construit

Une seule page, `commercant/tableau-de-bord.html`, qui reprend la maquette :

- **ordinateur** : la liste des commandes à gauche, le détail à droite ;
- **téléphone** : la liste, puis le détail avec « ← Retour aux commandes ».

Le commerçant peut filtrer par statut, ouvrir une commande, la faire avancer, revenir d'un cran, la refuser ou l'annuler (rupture de stock). Le backend ne change pas : le serveur envoie pour chaque commande la liste `actions` des boutons à afficher.

## Un ajustement de l'ordre des étapes

J'avais annoncé « Ma boutique et produits » avant le tableau de bord. Je fais l'inverse, parce que ce tableau supprime le besoin de piloter les commandes avec REST Client.

| Étape | Contenu |
|---|---|
| **31** (maintenant) | Tableau de bord : liste, détail, boutons de statut |
| **32** | Ma boutique (formulaire, envoi d'image) et gestion des produits |
| **33** | Historique du commerçant (pagination, résumé chiffré) |
| **34** | Bilan du Jour 4 : finitions, parcours complet, sauvegarde, rapport |

## Fichiers de l'étape

| Fichier | Action |
|---|---|
| `Front_end/css/style.css` | Ajout à la fin (section 2) |
| `Front_end/js/session.js` | Une ligne à changer (section 3) |
| `Front_end/js/menu.js` | Menu du commerçant à remplacer (section 4) |
| `Front_end/commercant/tableau-de-bord.html` | Créer (section 5) |
| `Front_end/js/page-tableau-de-bord.js` | Créer (section 6) |
| `tests-api/frontend-tableau-de-bord.http` | Créer (section 7) |

## Protections de l'étape

| Risque | Protection |
|---|---|
| Un client ou un visiteur ouvre la page | Visiteur : renvoyé vers la connexion. Client : message, **aucune** requête commerçant. Le vrai blocage reste le `403` du serveur |
| Un commerçant lit ou modifie les commandes d'un autre | Le serveur filtre sur `boutique_id` (session) et répond `404`. La page affiche « Commande introuvable. » |
| Adresse, téléphone ou nom de produit contenant du code | `textContent` uniquement |
| Lien `tel:` piégé | Le numéro est contrôlé (même règle que l'inscription) avant de fabriquer le lien |
| Un clic sur « Refuser » ou « Annuler » par erreur | Boîte de confirmation avec croix, aussi pour « Terminée » (définitif) |
| Double clic sur un bouton de statut | Tous les boutons sont désactivés pendant l'envoi |
| Le client annule pendant que le commerçant clique | Le serveur répond `409`, la page relit la commande et montre son état réel |
| Une vieille réponse écrase la bonne | Chaque chargement est vérifié (commande choisie, filtre) avant d'afficher |
| Tableau de bord figé | Actualisation automatique toutes les 30 secondes (onglet visible seulement) et bouton **Actualiser** |

---

## 1. Créer la branche et le dossier

```powershell
git switch main
git pull
git switch -c frontend-tableau-de-bord
mkdir Front_end/commercant
```

---

## 2. `Front_end/css/style.css` : ajouter à la fin

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

---

## 3. `Front_end/js/session.js` : une ligne

Dans `PAGES_ACCUEIL`, le commerçant arrive maintenant sur son tableau de bord :

```javascript
const PAGES_ACCUEIL = {
  client: '/liste-etablissements.html',
  commercant: '/commercant/tableau-de-bord.html'
};
```

---

## 4. `Front_end/js/menu.js` : menu du commerçant

Dans `MENUS`, **remplace** l'entrée `commercant` par celle-ci. Les liens deviennent aussi plus explicites, comme convenu pour les noms de fichiers :

```javascript
  commercant: [
    { texte: 'Commandes', lien: '/commercant/tableau-de-bord.html' },
    { texte: 'Historique', lien: '/commercant/historique-commandes.html' },
    { texte: 'Ma boutique', lien: '/commercant/ma-boutique.html' },
    { texte: 'Produits', lien: '/commercant/produits.html' }
  ]
```

Les trois derniers liens répondent `Cannot GET` jusqu'aux étapes 32 et 33. Si ton menu contient déjà ces liens, ne change rien.

---

## 5. `Front_end/commercant/tableau-de-bord.html` : créer

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tableau de bord · Ma MarketPlace</title>
  <link rel="stylesheet" href="/css/style.css">
  <script type="module" src="/js/menu.js"></script>
  <script type="module" src="/js/page-tableau-de-bord.js"></script>
</head>

<body>
  <header class="entete">
    <a class="marque" href="/">Ma MarketPlace</a>
    <nav id="menu" class="menu" aria-label="Navigation principale"></nav>
  </header>

  <main class="conteneur">
    <h1>Commandes en cours</h1>

    <!-- Retour des actions (statut mis à jour, refus du serveur...) et accès refusé -->
    <div id="messages" class="message" tabindex="-1" hidden></div>

    <div id="tableau" class="tableau">

      <!-- Liste des commandes -->
      <section id="panneau-liste" class="panneau-liste" aria-label="Liste des commandes">
        <div id="filtres" class="filtres" role="group" aria-label="Filtrer par statut"></div>

        <div class="ligne ligne-actualiser">
          <button id="actualiser" class="bouton bouton-secondaire" type="button">Actualiser</button>
          <span id="actualisation" class="discret" role="status"></span>
        </div>

        <div id="messages-liste" class="message" tabindex="-1" hidden></div>

        <!-- Lu par les lecteurs d'écran pendant le chargement -->
        <p id="etat" class="discret" role="status"></p>

        <div id="liste"></div>
      </section>

      <!-- Détail de la commande choisie -->
      <section id="panneau-detail" class="panneau-detail" aria-label="Détail de la commande">
        <p id="detail-vide" class="carte discret">Sélectionne une commande pour voir son détail.</p>

        <article id="detail" class="carte" hidden>
          <button id="retour-liste" class="lien-bouton btn-retour-liste" type="button">← Retour aux commandes</button>

          <!-- tabindex="-1" : le script peut y placer le focus à l'ouverture -->
          <h2 id="titre-detail" tabindex="-1">Commande n° <span id="numero"></span></h2>

          <span id="statut" class="badge"></span>

          <!-- Annulée ou refusée : un message explique qui a fermé la commande -->
          <p id="info-statut" class="message" hidden></p>

          <p id="maj" class="discret"></p>

          <h3>Client</h3>
          <p>Téléphone : <span id="telephone"></span></p>

          <h3>Livraison</h3>
          <p id="adresse"></p>

          <h3>Produits</h3>
          <ul id="lignes" class="liste-produits"></ul>

          <div class="ligne">
            <strong>Total</strong>
            <strong id="total" class="total-panier"></strong>
          </div>

          <!-- Les boutons viennent du serveur (champ "actions") -->
          <div id="actions" class="actions-commande"></div>
          <p id="aucune-action" class="discret" hidden>Plus aucune action possible sur cette commande.</p>
        </article>
      </section>
    </div>
  </main>

  <!-- Confirmation avant une action définitive (refuser, annuler, terminer) -->
  <dialog id="dialogue-statut" aria-labelledby="titre-confirmation">
    <form method="dialog">
      <div class="dialogue-entete">
        <h2 id="titre-confirmation"></h2>

        <button class="bouton-fermer" value="non" aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <p id="texte-confirmation"></p>

      <div class="dialogue-actions">
        <button class="bouton" value="oui">Confirmer</button>
        <button class="bouton bouton-secondaire" value="non">Retour</button>
      </div>
    </form>
  </dialog>
</body>
</html>
```

---

## 6. `Front_end/js/page-tableau-de-bord.js` : créer

```javascript
/* ===== page-tableau-de-bord.js : le tableau de bord du commerçant ===== */
import { appeler } from './api.js';
import { lireUtilisateur } from './session.js';
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
  Statuts finaux : la commande sort des « commandes en cours ».
  ⚠️ Doit rester identique à STATUTS_FINAUX dans Back_end/constantes.js.
*/
const STATUTS_FINAUX = ['terminee', 'annulee', 'refusee'];

// Statuts d'une commande fermée sans être livrée : badge neutre
const STATUTS_NEUTRES = ['annulee', 'refusee'];

/*
  Filtres de la liste. "statut: null" = toutes les commandes en cours.
  ⚠️ Les codes doivent correspondre aux statuts du serveur.
  🔧 À MODIFIER : pour changer un libellé de filtre, modifie ce tableau.
*/
const FILTRES = [
  { statut: null, libelle: 'En cours' },
  { statut: 'en_attente', libelle: 'En attente' },
  { statut: 'en_preparation', libelle: 'En préparation' },
  { statut: 'prete', libelle: 'Prêtes' },
  { statut: 'en_livraison', libelle: 'En livraison' }
];

/*
  Actions qui demandent une confirmation : celles qui ferment la commande.
  Les autres (accepter, prête, en livraison, revenir en arrière) partent tout de suite.
  🔧 À MODIFIER : pour confirmer une autre action, ajoute son statut ici.
*/
const CONFIRMATIONS = {
  refusee: {
    titre: 'Refuser la commande ?',
    texte: 'Le client verra que la commande est refusée.'
  },
  annulee: {
    titre: 'Annuler la commande ?',
    texte: 'Le client verra que tu as annulé la commande.'
  },
  terminee: {
    titre: 'Marquer la commande comme terminée ?',
    texte: 'Une commande terminée ne peut plus être modifiée.'
  }
};

// 🔧 À MODIFIER : délai entre deux actualisations automatiques (en millisecondes)
const DELAI_ACTUALISATION = 30 * 1000;

// ⚠️ Même règle que l'inscription (Back_end/routes/auth.js)
const REGEX_TELEPHONE = /^\+?[0-9 .-]{8,20}$/;

const ADRESSE_PAGE = '/commercant/tableau-de-bord.html';

const formatHeure = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });

const zoneMessages = document.getElementById('messages');
const zoneMessagesListe = document.getElementById('messages-liste');
const tableau = document.getElementById('tableau');
const zoneFiltres = document.getElementById('filtres');
const boutonActualiser = document.getElementById('actualiser');
const champActualisation = document.getElementById('actualisation');
const zoneEtat = document.getElementById('etat');
const zoneListe = document.getElementById('liste');
const detail = document.getElementById('detail');
const detailVide = document.getElementById('detail-vide');
const boutonRetour = document.getElementById('retour-liste');
const titreDetail = document.getElementById('titre-detail');
const champNumero = document.getElementById('numero');
const badgeStatut = document.getElementById('statut');
const infoStatut = document.getElementById('info-statut');
const champMaj = document.getElementById('maj');
const champTelephone = document.getElementById('telephone');
const champAdresse = document.getElementById('adresse');
const listeLignes = document.getElementById('lignes');
const champTotal = document.getElementById('total');
const zoneActions = document.getElementById('actions');
const aucuneAction = document.getElementById('aucune-action');
const dialogueStatut = document.getElementById('dialogue-statut');
const titreConfirmation = document.getElementById('titre-confirmation');
const texteConfirmation = document.getElementById('texte-confirmation');

// Filtre actif (null = toutes les commandes en cours)
let filtreActuel = null;

// Identifiant (texte) de la commande ouverte, ou null
let commandeChoisie = null;

/*
  Numéro de la dernière demande de liste. Si plusieurs chargements se croisent
  (clic rapide sur les filtres, actualisation automatique), une réponse tardive
  d'une ancienne demande ne doit pas écraser la dernière.
*/
let derniereDemande = 0;


/* ===== Outils ===== */

// Renvoie l'identifiant demandé dans l'adresse (?commande=12), ou null
function lireIdUrl() {
  const id = new URLSearchParams(window.location.search).get('commande');

  return id !== null && /^[1-9]\d{0,8}$/.test(id) ? id : null;
}

function classeBadge(statut) {
  return STATUTS_NEUTRES.includes(statut) ? 'badge badge-neutre' : 'badge';
}

// Phrase qui explique qui a fermé la commande ("" si elle est en cours)
function lireInfoStatut(commande) {
  if (commande.statut === 'refusee') {
    return 'Tu as refusé cette commande.';
  }

  if (commande.statut === 'annulee') {
    return commande.annulePar === 'client'
      ? 'Le client a annulé cette commande.'
      : 'Tu as annulé cette commande.';
  }

  return '';
}

// Met à jour l'adresse de la page sans la recharger (lien partageable, rechargement possible)
function memoriserCommande() {
  window.history.replaceState(
    null,
    '',
    commandeChoisie === null ? ADRESSE_PAGE : ADRESSE_PAGE + '?commande=' + commandeChoisie
  );
}


/* ===== La liste ===== */

// Une commande de la liste : un bouton qui ouvre son détail
function creerCarte(commande) {
  const carte = creerElement('button', '', 'carte-commande');
  const premiere = creerElement('span', '', 'ligne');
  const nombre = commande.nombreArticles;

  carte.type = 'button';
  carte.dataset.id = String(commande.id);

  if (String(commande.id) === commandeChoisie) {
    carte.setAttribute('aria-current', 'true');
  }

  premiere.append(
    creerElement('strong', 'Commande n° ' + commande.id),
    creerElement('span', commande.statutLibelle, classeBadge(commande.statut))
  );

  carte.append(
    premiere,
    creerElement(
      'span',
      `${nombre} ${nombre > 1 ? 'articles' : 'article'} · ${formaterPrix(commande.total)}`,
      'discret ligne-texte'
    ),
    creerElement('span', formaterDate(commande.dateCreation), 'discret ligne-texte')
  );

  carte.addEventListener('click', () => choisirCommande(commande.id));

  return carte;
}

// Met en évidence la commande ouverte dans la liste
function marquerSelection() {
  zoneListe.querySelectorAll('.carte-commande').forEach((carte) => {
    if (carte.dataset.id === commandeChoisie) {
      carte.setAttribute('aria-current', 'true');
    } else {
      carte.removeAttribute('aria-current');
    }
  });
}

async function chargerListe() {
  derniereDemande += 1;

  const numero = derniereDemande;
  const adresse = filtreActuel
    ? '/api/commercant/commandes?statut=' + encodeURIComponent(filtreActuel)
    : '/api/commercant/commandes';

  const reponse = await appeler('GET', adresse);

  // Une demande plus récente est partie entre-temps : cette réponse est périmée
  if (numero !== derniereDemande) {
    return;
  }

  zoneEtat.textContent = '';

  if (!reponse.ok) {
    afficherMessages(zoneMessagesListe, 'erreur', reponse.erreurs);
    return;
  }

  afficherMessages(zoneMessagesListe, 'info', []);

  /*
    Sans filtre, le serveur renvoie TOUTES les commandes (jusqu'à 100) : on ne
    garde que celles en cours. Les commandes terminées, annulées et refusées
    seront dans l'historique (étape 33).
  */
  const commandes = reponse.donnees.commandes.filter(
    (commande) => !STATUTS_FINAUX.includes(commande.statut)
  );

  zoneListe.replaceChildren();

  if (commandes.length === 0) {
    zoneListe.append(creerElement(
      'p',
      filtreActuel ? 'Aucune commande dans ce statut.' : 'Aucune commande en cours.',
      'discret'
    ));
    return;
  }

  commandes.forEach((commande) => {
    zoneListe.append(creerCarte(commande));
  });
}


/* ===== Les filtres ===== */

function choisirFiltre(statut) {
  filtreActuel = statut;

  zoneFiltres.querySelectorAll('button').forEach((bouton) => {
    const actif = (bouton.dataset.statut || null) === statut;

    bouton.setAttribute('aria-pressed', String(actif));
  });

  zoneEtat.textContent = 'Chargement…';
  chargerListe();
}

function construireFiltres() {
  FILTRES.forEach((filtre) => {
    const bouton = creerElement('button', filtre.libelle, 'puce');

    bouton.type = 'button';
    bouton.dataset.statut = filtre.statut || '';
    bouton.setAttribute('aria-pressed', String(filtre.statut === filtreActuel));
    bouton.addEventListener('click', () => choisirFiltre(filtre.statut));

    zoneFiltres.append(bouton);
  });
}


/* ===== Le détail ===== */

// Téléphone du client : un lien « tel: » si le numéro respecte la règle, sinon du texte
function afficherTelephone(telephone) {
  champTelephone.replaceChildren();

  if (REGEX_TELEPHONE.test(telephone)) {
    const lien = creerElement('a', telephone);

    // On ne garde que les chiffres et le "+" : jamais de texte libre dans le lien
    lien.href = 'tel:' + telephone.replace(/[ .-]/g, '');
    champTelephone.append(lien);
  } else {
    champTelephone.textContent = telephone;
  }
}

// Les boutons viennent du serveur : le premier est l'action principale
function afficherActions(commande) {
  zoneActions.replaceChildren();

  commande.actions.forEach((action, index) => {
    const bouton = creerElement(
      'button',
      action.libelle,
      index === 0 ? 'bouton' : 'bouton bouton-secondaire'
    );

    bouton.type = 'button';
    bouton.addEventListener('click', () => executerAction(commande, action));

    zoneActions.append(bouton);
  });

  aucuneAction.hidden = commande.actions.length > 0;
}

function afficherDetail(commande) {
  const texteInfo = lireInfoStatut(commande);

  champNumero.textContent = String(commande.id);

  badgeStatut.textContent = commande.statutLibelle;
  badgeStatut.className = classeBadge(commande.statut);

  infoStatut.textContent = texteInfo;
  infoStatut.hidden = texteInfo === '';

  champMaj.textContent = 'Passée le ' + formaterDate(commande.dateCreation)
    + ' · Dernière mise à jour : ' + formaterDate(commande.dateMiseAJour);

  afficherTelephone(commande.client.telephone);

  // textContent : une adresse contenant du HTML s'affiche comme du texte
  champAdresse.textContent = commande.adresseLivraison;

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

  afficherActions(commande);

  detail.hidden = false;
  detailVide.hidden = true;

  // Téléphone : la liste laisse sa place au détail (sans effet sur ordinateur)
  tableau.classList.add('detail-ouvert');
}

function fermerDetail() {
  commandeChoisie = null;
  memoriserCommande();

  detail.hidden = true;
  detailVide.hidden = false;
  tableau.classList.remove('detail-ouvert');

  marquerSelection();
}

/*
  Relit la commande ouverte sur le serveur.
    silencieux : true pour l'actualisation automatique (une erreur passagère ne
    doit pas barrer l'écran). Une commande introuvable ferme toujours le détail.
*/
async function chargerDetail(silencieux) {
  if (commandeChoisie === null) {
    return;
  }

  const identifiant = commandeChoisie;
  const reponse = await appeler('GET', '/api/commercant/commandes/' + identifiant);

  // L'utilisateur a ouvert une autre commande entre-temps : réponse périmée
  if (identifiant !== commandeChoisie) {
    return;
  }

  if (reponse.ok) {
    afficherDetail(reponse.donnees.commande);
    return;
  }

  // 404 : commande inexistante, ou d'une autre boutique
  if (reponse.statut === 404) {
    fermerDetail();
  }

  if (!silencieux || reponse.statut === 404) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
  }
}

async function choisirCommande(id) {
  commandeChoisie = String(id);
  memoriserCommande();

  afficherMessages(zoneMessages, 'info', []);
  marquerSelection();

  await chargerDetail(false);

  // Le focus passe sur le titre : les lecteurs d'écran annoncent la commande ouverte
  if (!detail.hidden) {
    titreDetail.focus();
  }
}


/* ===== Changer le statut ===== */

async function executerAction(commande, action) {
  const boutons = [...zoneActions.querySelectorAll('button')];
  const confirmation = CONFIRMATIONS[action.statut];

  // Action qui ferme la commande : on demande d'abord confirmation
  if (confirmation) {
    titreConfirmation.textContent = confirmation.titre;
    texteConfirmation.textContent = confirmation.texte;

    const accepte = await demanderConfirmation(dialogueStatut);

    if (!accepte) {
      return;
    }
  }

  // Tous les boutons sont bloqués pendant l'envoi : pas de double action
  boutons.forEach((bouton) => {
    bouton.disabled = true;
  });

  try {
    const reponse = await appeler(
      'PATCH',
      '/api/commercant/commandes/' + encodeURIComponent(commande.id) + '/statut',
      { statut: action.statut }
    );

    if (reponse.ok) {
      afficherMessages(zoneMessages, 'ok', [
        'Statut mis à jour : ' + reponse.donnees.commande.statutLibelle + '.'
      ]);

      // Le serveur renvoie la commande à jour, avec ses nouveaux boutons
      afficherDetail(reponse.donnees.commande);
    } else {
      /*
        409 : transition interdite, ou le client a annulé entre-temps.
        On montre le message du serveur et on relit l'état réel de la commande.
      */
      afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
      await chargerDetail(true);
    }
  } finally {
    boutons.forEach((bouton) => {
      bouton.disabled = false;
    });
  }

  await chargerListe();
}


/* ===== Actualisation ===== */

async function actualiser() {
  await Promise.all([chargerListe(), chargerDetail(true)]);

  champActualisation.textContent = 'Actualisé à ' + formatHeure.format(new Date());
}

function demarrer() {
  construireFiltres();

  // Adresse de la forme ?commande=12 : on rouvre cette commande
  commandeChoisie = lireIdUrl();

  zoneEtat.textContent = 'Chargement…';
  actualiser();

  boutonActualiser.addEventListener('click', () => pendant(boutonActualiser, actualiser));
  boutonRetour.addEventListener('click', fermerDetail);

  // Actualisation automatique, seulement si l'onglet est visible
  window.setInterval(() => {
    if (!document.hidden) {
      actualiser();
    }
  }, DELAI_ACTUALISATION);
}


/* ===== Accès réservé aux commerçants ===== */

/*
  Ce contrôle n'est qu'un confort : le serveur refuse de toute façon
  les requêtes d'un non-commerçant (401 ou 403).
*/
const utilisateur = await lireUtilisateur();

if (utilisateur === null) {
  window.location.href = '/connexion.html?retour=' + ADRESSE_PAGE;
} else if (utilisateur.role !== 'commercant') {
  tableau.hidden = true;
  afficherMessages(zoneMessages, 'erreur', ['Cette page est réservée aux commerçants.']);
} else {
  demarrer();
}
```

---

## 7. `tests-api/frontend-tableau-de-bord.http` : créer

Ces requêtes jouent le rôle du **client** : REST Client garde ses propres cookies, séparés du navigateur. Tu restes connecté en **boulangerie** dans le navigateur, et tu fabriques des commandes avec Alice depuis REST Client.

```http
### Numéro d'une commande à annuler côté client (visible dans le tableau de bord)
@commandeId = 1

### 1. Page du tableau de bord
GET http://localhost:3000/commercant/tableau-de-bord.html

### 2. Page du tableau de bord, sans l'extension
GET http://localhost:3000/commercant/tableau-de-bord

### 3. Module du tableau de bord
GET http://localhost:3000/js/page-tableau-de-bord.js

### 4. Module de session
GET http://localhost:3000/js/session.js


### ===== LE CLIENT (via REST Client) : fabriquer une commande =====

### 5. Connexion d'Alice
POST http://localhost:3000/api/auth/connexion
Content-Type: application/json

{ "email": "alice@example.com", "motDePasse": "Motdepasse1" }

### 6. Vider le panier
DELETE http://localhost:3000/api/panier

### 7. Ajouter 2 croissants (produit 2)
POST http://localhost:3000/api/panier/lignes
Content-Type: application/json

{ "produitId": 2, "quantite": 2 }

### 8. Ajouter 1 baguette (produit 1)
POST http://localhost:3000/api/panier/lignes
Content-Type: application/json

{ "produitId": 1, "quantite": 1 }

### 9. Passer la commande
POST http://localhost:3000/api/commandes
Content-Type: application/json

{ "adresseLivraison": "12 rue des Lilas, Abidjan" }

### 10. Alice tente d'utiliser le tableau de bord commerçant (doit être refusé)
GET http://localhost:3000/api/commercant/commandes

### 11. Annuler la commande (adapte @commandeId en haut du fichier)
POST http://localhost:3000/api/commandes/{{commandeId}}/annuler

### 12. Déconnexion
POST http://localhost:3000/api/auth/deconnexion
```

Résultats attendus :

| Requêtes | Codes |
|---|---|
| 1 à 4 | `200` partout |
| 5, 6, 7, 8 | `200` |
| 9 | `201` |
| 10 | **`403`** |
| 11 | `200` (la commande doit être encore en attente ou en préparation) |
| 12 | `200` |

Pour **fabriquer une commande**, envoie les requêtes **5 à 9** (puis 12 si tu veux fermer la session de REST Client). Le prix du croissant et de la baguette doit être celui de ta base (300 et 150 FCFA, soit **750 FCFA** les 3 articles).

---

## 8. Tests dans le navigateur

Chrome ou Edge, `F12` sur **Network** puis **Console**. Les comptes : **boulangerie** (commerçant, dans le navigateur) et **Alice** (client, dans REST Client, ou dans une fenêtre privée pour la voir changer).

### A. Accès à la page

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Déconnecté, ouvre `/commercant/tableau-de-bord.html` | Renvoi vers `/connexion.html?retour=%2Fcommercant%2Ftableau-de-bord.html` |
| 2 | Connecte **Alice** (client) dans le navigateur, ouvre la page | Message « Cette page est réservée aux commerçants. », **aucune** requête `commercant` dans Network |
| 3 | Déconnecte-toi, connecte la **boulangerie** | Tu arrives directement sur le tableau de bord, « Commandes » en gras dans le menu |
| 4 | Connecte `commercant@example.com` (sans boutique) | Message « Crée d'abord ta boutique. » : la page « Ma boutique » arrivera à l'étape 32 |

### B. La liste et le détail

Envoie les requêtes **5 à 9** deux fois, pour avoir deux commandes en attente.

| # | Action | Résultat attendu |
|---|---|---|
| 5 | Ouvre le tableau de bord (boulangerie) | Les commandes, la plus récente d'abord. Chacune : « Commande n° N », badge « En attente de validation du commerçant », `3 articles · 750 FCFA`, date |
| 6 | Clique sur **En attente**, puis **En préparation**, puis **En cours** | « En attente » : les commandes. « En préparation » : « Aucune commande dans ce statut. ». « En cours » : tout |
| 7 | Clique sur une commande | Le détail apparaît (à droite sur ordinateur), le contour de la carte devient vert, l'adresse du navigateur devient `?commande=N` |
| 8 | Regarde le détail | Numéro, badge, téléphone d'Alice (lien cliquable), adresse, lignes `Croissant × 2` et `Baguette × 1` avec sous-totaux, total `750 FCFA`, boutons **Accepter** (vert) et **Refuser** (contour) |
| 9 | Actualise la page (`F5`) | La même commande se rouvre toute seule |
| 10 | Mode appareil, largeur `390` | La liste seule s'affiche. Clic sur une commande : le détail remplace la liste, avec « ← Retour aux commandes » qui ramène à la liste. Pas de défilement horizontal |

### C. Faire avancer une commande

| # | Action | Résultat attendu |
|---|---|---|
| 11 | **Accepter** | Message vert « Statut mis à jour : En préparation. », badge mis à jour, boutons **Prête à être livrée** et **Annuler (rupture de stock)** |
| 12 | **Prête à être livrée** | Boutons **En livraison**, **Revenir en préparation**, **Annuler** |
| 13 | **Revenir en préparation**, puis de nouveau **Prête à être livrée** | La commande recule puis avance, sans erreur |
| 14 | **En livraison** | Boutons **Terminée** et **Revenir à prête**. **Aucun bouton Annuler** |
| 15 | **Terminée**, puis clique sur la **croix** de la boîte | La boîte « Marquer la commande comme terminée ? » se ferme, rien n'a changé |
| 16 | **Terminée** puis **Confirmer** | Badge « Terminée », texte « Plus aucune action possible sur cette commande. ». La commande **disparaît de la liste** « En cours » mais reste ouverte dans le détail |
| 17 | Sur la deuxième commande : **Refuser** puis **Confirmer** | Badge neutre « Refusée par le commerçant », texte « Tu as refusé cette commande. » |
| 18 | Nouvelle commande, **Accepter**, puis **Annuler (rupture de stock)** puis **Confirmer** | Badge neutre « Annulée », texte « Tu as annulé cette commande. » |

### D. Ce que voit le client

Dans une fenêtre privée, connecte Alice, ouvre `/suivi-commande.html?id=N` pour les commandes précédentes, et clique sur **Rafraîchir le statut** :

| # | Commande | Résultat attendu |
|---|---|---|
| 19 | Terminée (test 16) | Badge « Terminée », quatre barres colorées, plus de bouton Annuler |
| 20 | Refusée (test 17) | « Le commerçant a refusé cette commande. » |
| 21 | Annulée par le commerçant (test 18) | « Le commerçant a annulé cette commande. » |

### E. Deux acteurs en même temps

| # | Action | Résultat attendu |
|---|---|---|
| 22 | Fabrique une commande (5 à 9). Ouvre-la dans le tableau de bord. Dans REST Client, **annule-la** (requête 11 avec son numéro). **Sans actualiser**, clique sur **Accepter** | Message rouge du serveur (« Changement impossible » ou « La commande vient de changer »), puis la page se met à jour : badge « Annulée », texte « Le client a annulé cette commande. », plus de boutons |
| 23 | Tableau de bord ouvert, envoie une nouvelle commande avec REST Client (5 à 9) | Elle apparaît **toute seule** dans la liste en moins de 30 secondes, la ligne « Actualisé à HH:MM » change |
| 24 | Clique sur **Actualiser** | Même résultat, immédiatement |
| 25 | Double clic rapide sur **Accepter** (Network ouvert) | **Une seule** requête `statut` (PATCH) |

### F. Sécurité

| # | Action | Résultat attendu |
|---|---|---|
| 26 | Connecte l'**épicerie** (`epicerie@example.com`), ouvre le tableau de bord | Liste vide : « Aucune commande en cours. » (rien de la boulangerie) |
| 27 | Toujours avec l'épicerie, ouvre `/commercant/tableau-de-bord.html?commande=N` (N = commande de la boulangerie) | « Commande introuvable. », **aucun** détail affiché |
| 28 | Dans une fenêtre privée, Alice commande avec l'adresse `<img src=x onerror=alert(1)> Abidjan`. Ouvre cette commande dans le tableau de bord de la boulangerie | L'adresse s'affiche **en toutes lettres**, aucune image cassée, aucune fenêtre d'alerte |
| 29 | `?commande=abc` et `?commande=0` | Les deux sont ignorés : le détail reste vide |
| 30 | Console, sur chaque page | Aucune erreur `Refused to ...`. Le `401` de `/api/auth/moi` en visiteur est normal |

---

## Dépannage

| Problème | Cause probable et solution |
|---|---|
| La page affiche `Cannot GET /commercant/tableau-de-bord.html` | Le fichier n'est pas dans `Front_end/commercant/`, ou son nom diffère |
| Page vide, rien ne se charge | Console : `Failed to resolve import` ou `404` sur un `.js`. Compare les noms lettre par lettre |
| `Cannot read properties of null` | Un `id` du HTML ne correspond pas à celui du script. Compare `tableau`, `filtres`, `liste`, `detail`, `actions`, `dialogue-statut` |
| Renvoyé vers la connexion en boucle | Tu es connecté en client sur un autre onglet, ou la session a expiré : reconnecte la boulangerie |
| `401` sur `/api/commercant/commandes` alors que tu es connecté | Le cookie n'est pas envoyé : regarde l'onglet Network, et vérifie que `api.js` utilise `credentials: 'same-origin'` |
| Message « Crée d'abord ta boutique. » avec la boulangerie | Tu es connecté avec un autre compte commerçant : regarde l'email dans le menu |
| La liste reste vide alors que tu as des commandes | Regarde la réponse dans Network : si elle est correcte, vérifie `STATUTS_FINAUX` et le filtre actif. Les commandes finies n'apparaissent pas ici |
| Les commandes d'Alice n'apparaissent pas | Elles ont été faites pour une autre boutique : les produits 1 et 2 doivent appartenir à la boulangerie |
| Les boutons de statut ne s'affichent pas | La réponse du serveur n'a pas de champ `actions` : compare avec `Back_end/routes/commandes-commercant.js` |
| Un bouton ne répond pas | Console : erreur sur `PATCH`. Un `409` affiche un message rouge, c'est normal si la transition est interdite |
| La boîte de confirmation ne s'ouvre pas | L'`id` du `<dialog>` est faux, ou `showModal` est appelé sur `null` |
| Le détail ne se ferme pas sur téléphone | La classe `detail-ouvert` n'est pas retirée : vérifie `fermerDetail` et les deux règles de `.tableau` dans le CSS |
| Les deux panneaux ne sont pas côte à côte | Le bloc `@media (min-width: 900px)` du CSS est absent ou mal fermé |
| Le lien « Historique » donne `Cannot GET` | Normal : la page arrive à l'étape 33 |
| Une mise en gras apparaît dans l'adresse | **Arrête-toi** : un `innerHTML` s'est glissé dans le code. Remplace-le par `textContent` |

---

## À retenir

- **Le serveur décide des boutons.** Le tableau de bord n'a aucune règle de statut : il affiche la liste `actions`. Si tu changes une règle, tu modifies une seule ligne de `constantes.js` côté backend.
- **Toute action définitive se confirme.** Refuser, annuler et terminer ferment la commande : une boîte avec croix évite le clic malheureux.
- **Deux acteurs peuvent agir en même temps.** Le `409` n'est pas une erreur grave : la page affiche le message, relit l'état réel et continue.
- **Actualisation automatique, mais mesurée.** Elle s'arrête quand l'onglet est caché et se limite à une requête de liste et une de détail toutes les 30 secondes.
- **Une adresse de commande est une donnée du client.** Elle est lue par le commerçant de la boutique concernée seulement, et jamais interprétée comme du HTML.
