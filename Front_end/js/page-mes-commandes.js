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


