/* ===== Bloc 1 : importer les outils ===== */
const express = require('express');
const db = require('../db');
const { SECTEURS, FACTEUR } = require('../constantes');

const router = express.Router();


/* ===== Bloc 2 : réglages ===== */

// 🔧 À MODIFIER : nombre maximum de boutiques renvoyées d'un coup
const LIMITE_BOUTIQUES = 100;


/* ===== Bloc 3 : requêtes SQL préparées ===== */

/*
  "? IS NULL OR secteur = ?" : si aucun secteur n'est demandé (null),
  toutes les boutiques passent ; sinon on filtre sur le secteur.
  On ne sélectionne que les colonnes publiques.
*/
const listerBoutiques = db.prepare(`
  SELECT id, nom, description, secteur, image_chemin
  FROM boutiques
  WHERE (? IS NULL OR secteur = ?)
  ORDER BY nom
  LIMIT ?
`);

const lireBoutique = db.prepare(`
  SELECT id, nom, description, secteur, image_chemin
  FROM boutiques WHERE id = ?
`);

// Seulement les produits disponibles : "disponible = 1"
const listerProduitsDisponibles = db.prepare(`
  SELECT id, nom, description, prix_entier
  FROM produits
  WHERE boutique_id = ? AND disponible = 1
  ORDER BY nom
`);


/* ===== Bloc 4 : outils ===== */

// Convertit une ligne de la base en réponse lisible : 150 devient 1.5
function formaterProduit(produit) {
  return {
    id: produit.id,
    nom: produit.nom,
    description: produit.description,
    prix: produit.prix_entier / FACTEUR
  };
}

// Lit l'identifiant dans l'adresse. Renvoie null s'il est invalide.
function lireId(req) {
  const id = Number(req.params.id);

  return Number.isInteger(id) && id > 0 ? id : null;
}


/* ===== Bloc 5 : GET /boutiques (liste, filtre facultatif) ===== */

/*
  Exemples :
    /api/catalogue/boutiques
    /api/catalogue/boutiques?secteur=boulangerie
  Aucun gardien : cette route est publique.
*/
router.get('/boutiques', (req, res) => {
  const secteur = req.query.secteur;

  /*
    Si un secteur est demandé, il doit faire partie de la liste autorisée.
    Cela refuse aussi les cas piégés (?secteur=a&secteur=b envoie un tableau).
  */
  if (secteur !== undefined && !SECTEURS.includes(secteur)) {
    return res.status(400).json({
      erreurs: [`Secteur invalide (choisis parmi : ${SECTEURS.join(', ')}).`]
    });
  }

  const filtre = secteur === undefined ? null : secteur;
  const boutiques = listerBoutiques.all(filtre, filtre, LIMITE_BOUTIQUES);

  return res.json({ boutiques });
});


/* ===== Bloc 6 : GET /boutiques/:id (une boutique et ses produits) ===== */
router.get('/boutiques/:id', (req, res) => {
  const id = lireId(req);

  if (id === null) {
    return res.status(404).json({ erreurs: ['Boutique introuvable.'] });
  }

  const boutique = lireBoutique.get(id);

  if (!boutique) {
    return res.status(404).json({ erreurs: ['Boutique introuvable.'] });
  }

  const produits = listerProduitsDisponibles.all(id).map(formaterProduit);

  return res.json({ boutique, produits });
});


/* ===== Bloc 7 : partager le router ===== */
module.exports = router;