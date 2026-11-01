/* ===== fiche-etablissement.js : la fiche d'un établissement et ses produits ===== */
import { appeler } from './api.js';
import { libelleSecteur } from './secteurs.js';
import { afficherMessages, creerElement, creerImage, formaterPrix } from './outils.js';

const zoneMessages = document.getElementById('messages');
const fiche = document.getElementById('fiche');
const banniere = document.getElementById('banniere');
const champNom = document.getElementById('nom');
const champSecteur = document.getElementById('secteur');
const champDescription = document.getElementById('description');
const listeProduits = document.getElementById('liste-produits');
const aucunProduit = document.getElementById('aucun-produit');


/* ===== Lecture de l'identifiant dans l'adresse ===== */

/*
  Renvoie l'identifiant de la boutique (?id=3), ou null s'il est absent ou
  suspect. On n'accepte que des chiffres, sans zéro au début : l'identifiant
  est ensuite collé dans l'adresse de l'API.
*/
function lireId() {
  const id = new URLSearchParams(window.location.search).get('id');

  return id !== null && /^[1-9]\d{0,8}$/.test(id) ? id : null;
}


/* ===== Affichage ===== */

// Une ligne de produit : nom, description éventuelle, prix en FCFA
function creerProduit(produit) {
  const ligne = creerElement('li', '', 'produit ligne');
  const texte = creerElement('div', '', 'carte-texte');

  texte.append(creerElement('span', produit.nom, 'produit-nom'));

  if (produit.description) {
    texte.append(creerElement('p', produit.description, 'discret produit-description'));
  }

  ligne.append(texte, creerElement('span', formaterPrix(produit.prix), 'prix'));

  return ligne;
}

async function charger() {
  const id = lireId();

  if (id === null) {
    afficherMessages(zoneMessages, 'erreur', ['Boutique introuvable.']);
    return;
  }

  const reponse = await appeler('GET', '/api/catalogue/boutiques/' + id, undefined, {
    sansRedirection: true
  });

  // 404 : boutique inexistante. Autre échec : message nettoyé par api.js
  if (!reponse.ok) {
    afficherMessages(zoneMessages, 'erreur', reponse.erreurs);
    return;
  }

  const { boutique, produits } = reponse.donnees;

  // document.title traite aussi la valeur comme du texte
  document.title = boutique.nom + ' · Ma MarketPlace';

  banniere.replaceChildren(creerImage(boutique.image_chemin, '', 'banniere'));

  champNom.textContent = boutique.nom;
  champSecteur.textContent = libelleSecteur(boutique.secteur);
  champDescription.textContent = boutique.description;
  champDescription.hidden = !boutique.description;

  listeProduits.replaceChildren();
  aucunProduit.hidden = produits.length > 0;

  produits.forEach((produit) => {
    listeProduits.append(creerProduit(produit));
  });

  fiche.hidden = false;
}

charger();




