/* ===== fiche-etablissement.js : un établissement et ses produits ===== */
import { appeler } from '/partage/js/api.js';
import { ajouterAuPanier } from '/panier/ajout-panier.js';
import { libelleSecteur } from '/partage/js/secteurs.js';
import { lireUtilisateur } from '/partage/js/session.js';
import {
  afficherMessages,
  creerElement,
  creerImage,
  formaterPrix,
  pendant
} from '/partage/js/outils.js';

/*
  Quantité maximale d'un même produit dans un panier.
  ⚠️ Doit rester identique à QUANTITE_MAX dans Back_end/routes/panier.js.
*/
const QUANTITE_MAX = 20;

const zoneMessages = document.getElementById('messages');
const zoneAjout = document.getElementById('messages-ajout');
const fiche = document.getElementById('fiche');
const banniere = document.getElementById('banniere');
const champNom = document.getElementById('nom');
const champSecteur = document.getElementById('secteur');
const champDescription = document.getElementById('description');
const listeProduits = document.getElementById('liste-produits');
const aucunProduit = document.getElementById('aucun-produit');
//const noteVisiteur = document.getElementById('note-visiteur');
const dialogueConnexion = document.getElementById('dialogue-connexion');

// Vrai si personne n'est connecté : le bouton Ajouter ouvre alors la boîte de connexion
let visiteur = false;

creerControleAjout


// Ce que le module d'ajout a besoin de connaître de la page
const elementsPanier = {
  zoneMessages: zoneAjout,
  dialogueConflit: document.getElementById('dialogue-conflit'),
  nomBoutiqueConflit: document.getElementById('conflit-nom')
};


/* ===== Lecture de l'identifiant dans l'adresse ===== */

/*
  Renvoie l'identifiant de l'établissement (?id=3), ou null s'il est absent ou
  suspect. On n'accepte que des chiffres, sans zéro au début : l'identifiant
  est ensuite collé dans l'adresse de l'API.
*/
function lireId() {
  const id = new URLSearchParams(window.location.search).get('id');

  return id !== null && /^[1-9]\d{0,8}$/.test(id) ? id : null;
}


/* ===== Affichage ===== */

// Le champ de quantité et le bouton « Ajouter » d'un produit
function creerControleAjout(produit) {
  const conteneur = creerElement('div', '', 'commande-produit');

  const champ = document.createElement('input');

  champ.type = 'number';
  champ.id = 'quantite-' + produit.id;
  champ.min = '1';
  champ.max = String(QUANTITE_MAX);
  champ.step = '1';
  champ.value = '1';
  champ.className = 'champ quantite';

  // Étiquette lue par les lecteurs d'écran, invisible à l'écran
  const etiquette = creerElement('label', 'Quantité de ' + produit.nom, 'cache-visuel');

  etiquette.htmlFor = champ.id;

  const bouton = creerElement('button', 'Ajouter', 'bouton');

  bouton.type = 'button';
  bouton.setAttribute('aria-label', 'Ajouter au panier : ' + produit.nom);

  bouton.addEventListener('click', () => {
    const quantite = Number(champ.value);

    //-------------------- nouveau
        // Visiteur : on propose de se connecter, sans appeler le serveur
    if (visiteur) {
      dialogueConnexion.showModal();
      return;
    }
    //--------------------

    // Confort seulement : le serveur revérifie tout
    if (!Number.isInteger(quantite) || quantite < 1 || quantite > QUANTITE_MAX) {
      afficherMessages(zoneAjout, 'erreur', [
        `Quantité invalide (entier de 1 à ${QUANTITE_MAX}).`
      ]);
      return;
    }

    pendant(bouton, () => ajouterAuPanier(produit, quantite, elementsPanier));
  });

  conteneur.append(etiquette, champ, bouton);

  return conteneur;
}


// Une ligne de produit : nom, description éventuelle, prix, et l'ajout si possible
function creerProduit(produit, peutCommander) {
  const ligne = creerElement('li', '', 'produit ligne');
  const texte = creerElement('div', '', 'carte-texte');

  texte.append(creerElement('span', produit.nom, 'produit-nom'));

  if (produit.description) {
    texte.append(creerElement('p', produit.description, 'discret produit-description'));
  }

  ligne.append(texte, creerElement('span', formaterPrix(produit.prix), 'prix'));

  if (peutCommander) {
    ligne.append(creerControleAjout(produit));
  }

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



  /*
    Visiteur et client voient le bouton Ajouter (le visiteur est invité à se
    connecter au clic). Un commerçant ne commande pas : aucun bouton.
  */
  const utilisateur = await lireUtilisateur();
  visiteur = utilisateur === null;
  const peutCommander = visiteur || utilisateur.role === 'client';




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
    listeProduits.append(creerProduit(produit, peutCommander));
  });

  fiche.hidden = false;
}

charger();