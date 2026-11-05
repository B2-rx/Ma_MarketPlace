/* ===== page-historique-commandes.js : l'historique des commandes du commerçant ===== */

/* ---- 1. IMPORTS : les outils partagés ---- */
import { appeler } from '/partage/js/api.js';
import { lireUtilisateur } from '/partage/js/session.js';
import { afficherMessages, creerElement, formaterDate, formaterPrix } from '/partage/js/outils.js';


/* ---- 2. RÉGLAGES ---- */

// 🔧 À MODIFIER : nombre de commandes par page (le serveur accepte de 1 à 50)
const LIMITE = 10;

// Statuts d'une commande fermée sans être livrée : badge neutre
// ⚠️ Doit rester identique à STATUTS_NEUTRES dans page-tableau-de-bord.js
const STATUTS_NEUTRES = ['annulee', 'refusee'];

/*
  Filtres. "statut: null" = toutes les commandes clôturées.
  ⚠️ Les codes doivent correspondre aux statuts finaux de Back_end/constantes.js.
*/
const FILTRES = [
  { statut: null, libelle: 'Toutes' },
  { statut: 'terminee', libelle: 'Terminées' },
  { statut: 'annulee', libelle: 'Annulées' },
  { statut: 'refusee', libelle: 'Refusées' }
];


/* ---- 3. ÉLÉMENTS DE LA PAGE ET ÉTAT ---- */
const zoneMessages = document.getElementById('messages');
const contenu = document.getElementById('contenu');
const zoneFiltres = document.getElementById('filtres');
const zoneEtat = document.getElementById('etat');
const zoneListe = document.getElementById('liste');
const zonePagination = document.getElementById('pagination');
const boutonPrecedent = document.getElementById('precedent');
const boutonSuivant = document.getElementById('suivant');
const indicateur = document.getElementById('indicateur');

const champTerminees = document.getElementById('resume-terminees');
const champCa = document.getElementById('resume-ca');
const champAnnulees = document.getElementById('resume-annulees');
const champRefusees = document.getElementById('resume-refusees');

let filtreActuel = null; // null = toutes
let pageActuelle = 1;
let pagesTotal = 1;
let derniereDemande = 0; // numéro de la dernière requête envoyée


/* ---- 4. AFFICHAGE ---- */

function classeBadge(statut) {
  return STATUTS_NEUTRES.includes(statut) ? 'badge badge-neutre' : 'badge';
}

// Phrase qui explique qui a fermé la commande ("" si elle est terminée)
// 🔧 Les phrases reprennent celles du tableau de bord (même ton).
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

function afficherResume(resume) {
  champTerminees.textContent = String(resume.terminees.nombre);
  champCa.textContent = formaterPrix(resume.terminees.chiffreAffaires);
  champAnnulees.textContent = String(resume.annulees.nombre);
  champRefusees.textContent = String(resume.refusees.nombre);
}

// Une commande clôturée : une carte (pas de clic, l'historique est en lecture seule)
function creerCarte(commande) {
  const carte = creerElement('li', '', 'carte carte-historique');
  const premiere = creerElement('div', '', 'ligne');
  const nombre = commande.nombreArticles ?? 0;

  premiere.append(
    creerElement('strong', 'Commande n° ' + commande.id),
    creerElement('span', commande.statutLibelle, classeBadge(commande.statut))
  );

  carte.append(
    premiere,
    creerElement(
      'p',
      `${nombre} ${nombre > 1 ? 'articles' : 'article'} · ${formaterPrix(commande.total)}`,
      'discret'
    )
  );

  const info = lireInfoStatut(commande);

  if (info !== '') {
    carte.append(creerElement('p', info, 'discret'));
  }

  carte.append(
    creerElement('p', 'Passée le ' + formaterDate(commande.dateCreation), 'discret'),
    // Pour une commande clôturée, la date de mise à jour est la date de clôture
    creerElement('p', 'Clôturée le ' + formaterDate(commande.dateMiseAJour), 'discret')
  );

  return carte;
}

function afficherCommandes(commandes) {
  zoneListe.replaceChildren();

  if (commandes.length === 0) {
    zoneListe.append(creerElement(
      'li',
      filtreActuel ? 'Aucune commande dans ce statut.' : 'Aucune commande clôturée.',
      'discret'
    ));
    return;
  }

  commandes.forEach((commande) => zoneListe.append(creerCarte(commande)));
}

function afficherPagination(pagination) {
  pagesTotal = Math.max(pagination.pages, 1);

  indicateur.textContent = `Page ${pagination.page} sur ${pagesTotal}`;
  boutonPrecedent.disabled = pagination.page <= 1;
  boutonSuivant.disabled = pagination.page >= pagesTotal;

  // Une seule page : pas besoin de pagination
  zonePagination.hidden = pagination.pages <= 1;
}


/* ---- 5. CHARGEMENT ---- */

async function charger() {
  derniereDemande += 1;

  const numero = derniereDemande;
  let adresse = `/api/commercant/commandes/historique?page=${pageActuelle}&limite=${LIMITE}`;

  if (filtreActuel) {
    adresse += '&statut=' + encodeURIComponent(filtreActuel);
  }

  zoneEtat.textContent = 'Chargement…';

  const reponse = await appeler('GET', adresse);

  // Une demande plus récente est partie entre-temps : cette réponse est périmée
  if (numero !== derniereDemande) {
    return;
  }

  zoneEtat.textContent = '';

  if (!reponse.ok) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
    return;
  }

  afficherMessages(zoneMessages, 'info', []);

  const { resume, pagination, commandes } = reponse.donnees;

  afficherResume(resume);
  afficherCommandes(commandes);
  afficherPagination(pagination);
}


/* ---- 6. FILTRES ET PAGES ---- */

function choisirFiltre(statut) {
  filtreActuel = statut;
  pageActuelle = 1; // un nouveau filtre repart toujours de la page 1

  zoneFiltres.querySelectorAll('button').forEach((bouton) => {
    const actif = (bouton.dataset.statut || null) === statut;

    bouton.setAttribute('aria-pressed', String(actif));
  });

  charger();
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

function changerPage(decalage) {
  const nouvelle = pageActuelle + decalage;

  if (nouvelle < 1 || nouvelle > pagesTotal) {
    return;
  }

  pageActuelle = nouvelle;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  charger();
}

boutonPrecedent.addEventListener('click', () => changerPage(-1));
boutonSuivant.addEventListener('click', () => changerPage(1));


/* ---- 7. DÉMARRAGE ----
   Ce contrôle n'est qu'un confort : le serveur refuse de toute façon
   les requêtes d'un non-commerçant (401 ou 403). */
const utilisateur = await lireUtilisateur();

if (utilisateur === null) {
  window.location.href = '/connexion/connexion.html?retour='
    + encodeURIComponent(window.location.pathname);
} else if (utilisateur.role !== 'commercant') {
  contenu.hidden = true;
  afficherMessages(zoneMessages, 'erreur', ['Cette page est réservée aux commerçants.']);
} else {
  construireFiltres();
  charger();
}