/* ===== page-tableau-de-bord.js : le tableau de bord du commerçant ===== */
import { appeler } from '/partage/js/api.js';
import { lireUtilisateur } from '/partage/js/session.js';
import {
  afficherMessages,
  creerElement,
  demanderConfirmation,
  formaterDate,
  formaterPrix,
  pendant
} from '/partage/js/outils.js';


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

const ADRESSE_PAGE = '/commercant/tableau-de-bord/tableau-de-bord.html';

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
  window.location.href = '/connexion/connexion.html?retour=' + ADRESSE_PAGE;
} else if (utilisateur.role !== 'commercant') {
  tableau.hidden = true;
  afficherMessages(zoneMessages, 'erreur', ['Cette page est réservée aux commerçants.']);
} else {
  demarrer();
}