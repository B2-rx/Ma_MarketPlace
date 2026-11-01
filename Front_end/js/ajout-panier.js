/* ===== ajout-panier.js : ajouter un produit, avec le cas du conflit ===== */
import { appeler } from './api.js';
import { afficherMessages, demanderConfirmation } from './outils.js';

// Envoie l'ajout. Aucun prix : seulement un identifiant et une quantité
function envoyerAjout(produitId, quantite) {
  return appeler(
    'POST',
    '/api/panier/lignes',
    { produitId, quantite },
    { sansRedirection: true }
  );
}

/*
  Ajoute un produit au panier du client connecté.
    produit  : { id, nom, ... } tel que reçu du serveur
    quantite : entier déjà contrôlé par la page
    elements : { zoneMessages, dialogueConflit, nomBoutiqueConflit }

  Scénario du cahier des charges :
    1) le serveur refuse (409) car le panier contient un autre établissement ;
    2) on demande à l'utilisateur s'il veut vider son panier ;
    3) s'il accepte : on vide, puis on retente l'ajout.
*/
export async function ajouterAuPanier(produit, quantite, elements) {
  let reponse = await envoyerAjout(produit.id, quantite);

  if (reponse.statut === 409 && reponse.donnees.conflit) {
    // textContent : le nom vient du serveur, il n'est jamais lu comme du HTML
    elements.nomBoutiqueConflit.textContent = reponse.donnees.conflit.boutiqueNom;

    const accepte = await demanderConfirmation(elements.dialogueConflit);

    if (!accepte) {
      afficherMessages(elements.zoneMessages, 'info', ["Ton panier n'a pas été modifié."]);
      return;
    }

    const vidage = await appeler('DELETE', '/api/panier', undefined, { sansRedirection: true });

    if (!vidage.ok) {
      afficherMessages(elements.zoneMessages, 'erreur', vidage.erreurs);
      return;
    }

    reponse = await envoyerAjout(produit.id, quantite);
  }

  if (reponse.ok) {
    // Le serveur renvoie la quantité TOTALE de ce produit dans le panier
    afficherMessages(elements.zoneMessages, 'ok', [
      `${produit.nom} : ${reponse.donnees.ligne.quantite} dans ton panier.`
    ]);
    return;
  }

  // Session expirée : on renvoie vers la connexion
  if (reponse.statut === 401) {
    window.location.href = '/connexion.html?retour=/liste-etablissements.html';
    return;
  }

  afficherMessages(elements.zoneMessages, 'erreur', reponse.erreurs);
}




