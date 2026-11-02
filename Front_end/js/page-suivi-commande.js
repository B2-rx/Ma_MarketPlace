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


