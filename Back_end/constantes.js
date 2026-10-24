/* ===== Constantes partagées entre plusieurs fichiers ===== */

/*
  Secteurs autorisés pour une boutique.
  🔧 À MODIFIER : pour ajouter un secteur, ajoute-le ici (un seul endroit).
*/
const SECTEURS = ['restauration', 'boulangerie', 'epicerie', 'boissons', 'autre'];

/*
  Nombre de décimales de la monnaie : 2 pour l'euro (1.50).
  ⚠️ Ne le change plus une fois des produits enregistrés : les prix sont
  stockés en nombres entiers (1.50 devient 150).
*/
const DECIMALES = 2;
const FACTEUR = 10 ** DECIMALES;   // 100 pour 2 décimales


/* ===== Statuts d'une commande ===== */

/*
  Dans l'ordre de son cycle de vie.
  ⚠️ Cette liste doit rester identique au CHECK de la table "commandes" (db.js).
*/
const STATUTS = [
  'en_attente',
  'en_preparation',
  'prete',
  'en_livraison',
  'terminee',
  'annulee',
  'refusee'
];

// Une commande naît "en_attente" : le commerçant doit l'accepter ou la refuser
const STATUT_INITIAL = 'en_attente';
const STATUT_ANNULE = 'annulee';

// Libellés lisibles : le frontend n'a pas à les réécrire, le serveur les envoie
const LIBELLES_STATUTS = {
  en_attente: 'En attente de validation du commerçant',
  en_preparation: 'En préparation',
  prete: 'Prête à être livrée',
  en_livraison: 'En livraison',
  terminee: 'Terminée',
  annulee: 'Annulée',
  refusee: 'Refusée par le commerçant'
};

/*
  Statuts dans lesquels le CLIENT peut encore annuler.
  Dès que la commande est prête, le bouton est grisé.
  🔧 À MODIFIER : pour changer la règle, modifie seulement cette liste.
*/
const STATUTS_ANNULABLES_CLIENT = ['en_attente', 'en_preparation'];

// Qui a annulé la commande (colonne "annule_par")
const ANNULE_PAR_CLIENT = 'client';
const ANNULE_PAR_COMMERCANT = 'commercant';


module.exports = {
  SECTEURS,
  DECIMALES,
  FACTEUR,
  STATUTS,
  STATUT_INITIAL,
  STATUT_ANNULE,
  LIBELLES_STATUTS,
  STATUTS_ANNULABLES_CLIENT,
  ANNULE_PAR_CLIENT,
  ANNULE_PAR_COMMERCANT
};