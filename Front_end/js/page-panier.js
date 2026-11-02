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





