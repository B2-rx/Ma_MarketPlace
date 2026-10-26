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


/*
  Transitions autorisées pour le COMMERÇANT : statut actuel -> actions possibles.
  "libelle" est le texte du bouton affiché dans le tableau de bord.
  🔧 À MODIFIER : pour changer une règle, modifie seulement ce tableau.
  Jamais de retour vers "en_attente" : une commande acceptée ne redevient pas
  "en attente".
*/
const TRANSITIONS_COMMERCANT = {
  en_attente: [
    { vers: 'en_preparation', libelle: 'Accepter' },
    { vers: 'refusee', libelle: 'Refuser' }
  ],
  en_preparation: [
    { vers: 'prete', libelle: 'Prête à être livrée' },
    { vers: 'annulee', libelle: 'Annuler (rupture de stock)' }
  ],
  prete: [
    { vers: 'en_livraison', libelle: 'En livraison' },
    { vers: 'en_preparation', libelle: 'Revenir en préparation' },
    { vers: 'annulee', libelle: 'Annuler' }
  ],
  en_livraison: [
    { vers: 'terminee', libelle: 'Terminée' },
    { vers: 'prete', libelle: 'Revenir à prête' }
  ],
  terminee: [],
  annulee: [],
  refusee: []
};


/*
  Statuts finaux : ceux d'où le commerçant ne peut plus rien faire.
  On les DÉDUIT du tableau des transitions : si tu modifies une règle,
  cette liste reste juste sans que tu aies à y penser.
*/
const STATUTS_FINAUX = STATUTS.filter(
  (statut) => TRANSITIONS_COMMERCANT[statut].length === 0
);


/* ===== Adresse de livraison ===== */

/*
  Longueur de l'adresse saisie à la commande.
  ⚠️ Ces bornes doivent rester identiques au CHECK de "adresse_livraison" (db.js).
*/
const ADRESSE_MIN = 10;
const ADRESSE_MAX = 200;


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
  ANNULE_PAR_COMMERCANT,
  TRANSITIONS_COMMERCANT,
  STATUTS_FINAUX,
  ADRESSE_MIN,
  ADRESSE_MAX
};