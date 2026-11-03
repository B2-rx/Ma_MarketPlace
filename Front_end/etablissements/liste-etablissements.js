/* ===== boutiques.js : la liste des établissements ===== */
import { appeler } from '/partage/js/api.js';
import { SECTEURS, libelleSecteur } from '/partage/js/secteurs.js';
import { afficherMessages, creerElement, creerImage } from '/partage/js/outils.js';

const zoneFiltres = document.getElementById('filtres');
const zoneMessages = document.getElementById('messages');
const zoneListe = document.getElementById('liste');
const zoneEtat = document.getElementById('etat');

/*
  Numéro de la dernière demande envoyée. Si l'utilisateur clique vite sur
  plusieurs filtres, une réponse plus lente d'une ancienne demande ne doit
  pas écraser la dernière.
*/
let derniereDemande = 0;


/* ===== Lecture du filtre dans l'adresse ===== */

// Renvoie le secteur demandé dans l'adresse, ou null s'il est absent ou inconnu
function lireSecteurUrl() {
  const secteur = new URLSearchParams(window.location.search).get('secteur');

  return SECTEURS.some((element) => element.code === secteur) ? secteur : null;
}


/* ===== Affichage ===== */

// Une carte d'établissement
function creerCarte(boutique) {
  const carte = creerElement('article', '', 'carte carte-boutique');
  const texte = creerElement('div', '', 'carte-texte');
  const titre = creerElement('h2', '', 'titre-carte');
  const lien = creerElement('a', boutique.nom);

  // L'identifiant est un entier fabriqué par le serveur
  lien.href = '/etablissements/fiche-etablissement.html?id=' + encodeURIComponent(boutique.id);
  titre.append(lien);

  texte.append(titre, creerElement('span', libelleSecteur(boutique.secteur), 'badge'));

  if (boutique.description) {
    texte.append(creerElement('p', boutique.description, 'discret'));
  }

  carte.append(creerImage(boutique.image_chemin, '', 'vignette'), texte);

  return carte;
}

// Charge et affiche les établissements d'un secteur (null = tous)
async function charger(secteur) {
  derniereDemande += 1;

  const numero = derniereDemande;
  const adresse = secteur
    ? '/api/catalogue/boutiques?secteur=' + encodeURIComponent(secteur)
    : '/api/catalogue/boutiques';

  zoneEtat.textContent = 'Chargement…';

  const reponse = await appeler('GET', adresse, undefined, { sansRedirection: true });

  // Une demande plus récente est partie entre-temps : cette réponse est périmée
  if (numero !== derniereDemande) {
    return;
  }

  zoneEtat.textContent = '';
  zoneListe.replaceChildren();

  if (!reponse.ok) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
    return;
  }

  // Aucun message : la zone se cache
  afficherMessages(zoneMessages, 'info', []);

  const boutiques = reponse.donnees.boutiques;

  if (boutiques.length === 0) {
    zoneListe.append(creerElement('p', 'Aucun établissement dans cette catégorie.', 'discret'));
    return;
  }

  boutiques.forEach((boutique) => {
    zoneListe.append(creerCarte(boutique));
  });
}


/* ===== Filtres ===== */

// Coche le bon bouton, met à jour l'adresse (lien partageable) et recharge
function choisir(secteur) {
  zoneFiltres.querySelectorAll('button').forEach((bouton) => {
    const actif = (bouton.dataset.secteur || null) === secteur;

    bouton.setAttribute('aria-pressed', String(actif));
  });

  window.history.replaceState(
    null,
    '',
    secteur ? '/etablissements/liste-etablissements.html?secteur=' + encodeURIComponent(secteur) : '/etablissements/liste-etablissements.html'
  );

  charger(secteur);
}

// Le bouton « Tous » et un bouton par secteur
[{ code: '', libelle: 'Tous' }, ...SECTEURS].forEach((secteur) => {
  const bouton = creerElement('button', secteur.libelle, 'puce');

  bouton.type = 'button';
  bouton.dataset.secteur = secteur.code;
  bouton.addEventListener('click', () => choisir(secteur.code || null));

  zoneFiltres.append(bouton);
});

// Premier affichage : le secteur demandé dans l'adresse, sinon tous
choisir(lireSecteurUrl());




