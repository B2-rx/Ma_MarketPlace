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


module.exports = { SECTEURS, DECIMALES, FACTEUR };