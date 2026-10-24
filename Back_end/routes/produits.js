// ===== Bloc 1 : importer les outils =====
const express = require('express');
const db = require('../db');
const { exigerRole } = require('../middlewares/auth');
const { DECIMALES, FACTEUR } = require('../constantes');
const router = express.Router();



// ===== Bloc 2 : réglages =====

// 🔧 À MODIFIER : prix maximum autorisé (dans l'unité normale, ex. en euros)
const PRIX_MAX = 10000000;



// ===== Bloc 3 : requêtes SQL préparées =====
// Retrouve la boutique du commerçant connecté
const trouverBoutique = db.prepare(`SELECT id FROM boutiques WHERE utilisateur_id = ?`);

const listerProduits = db.prepare(`
  SELECT id, nom, description, prix_entier, disponible
  FROM produits WHERE boutique_id = ? ORDER BY id
`);

// Double condition : l'id du produit ET la boutique. C'est le coeur de la sécurité.
const lireProduit = db.prepare(`
  SELECT id, nom, description, prix_entier, disponible
  FROM produits WHERE id = ? AND boutique_id = ?
`);

const insererProduit = db.prepare(`
  INSERT INTO produits (boutique_id, nom, description, prix_entier, disponible)
  VALUES (?, ?, ?, ?, ?)
`);

const modifierProduit = db.prepare(`
  UPDATE produits SET nom = ?, description = ?, prix_entier = ?, disponible = ?
  WHERE id = ? AND boutique_id = ?
`);

const supprimerProduit = db.prepare(`
  DELETE FROM produits WHERE id = ? AND boutique_id = ?
`);



// ===== Bloc 4 : outils =====

// Convertit une ligne de la base en réponse lisible :
// 150 devient 1.5, et 1 devient true.
function formater(produit) {
  return {
    id: produit.id,
    nom: produit.nom,
    description: produit.description,
    prix: produit.prix_entier / FACTEUR,
    disponible: produit.disponible === 1
  };
}

// Vérifie les données reçues et renvoie la liste des problèmes (vide = tout est bon)
function validerProduit(donnees) {
  const erreurs = [];
  const { nom, description, prix, disponible } = donnees;

  if (typeof nom !== 'string' || nom.trim().length < 2 || nom.trim().length > 80) {
    erreurs.push('Nom invalide (2 à 80 caractères).');
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.trim().length > 300) {
      erreurs.push('Description invalide (300 caractères maximum).');
    }
  }

  // Prix : un nombre (pas du texte), positif ou nul, borné, et sans trop de décimales.
  // La dernière condition refuse par exemple 1.234 quand DECIMALES vaut 2.
  if (
    typeof prix !== 'number' ||
    !Number.isFinite(prix) ||
    prix < 0 ||
    prix > PRIX_MAX ||
    Math.abs(prix * FACTEUR - Math.round(prix * FACTEUR)) > 1e-6
  ) {
    erreurs.push(`Prix invalide (nombre positif, ${DECIMALES} décimale(s) maximum).`);
  }

  // Disponible : facultatif, mais si présent, ce doit être true ou false
  if (disponible !== undefined && typeof disponible !== 'boolean') {
    erreurs.push('Disponibilité invalide (true ou false).');
  }

  return erreurs;
}



// Lit l'identifiant dans l'adresse (/api/produits/3). Renvoie null s'il est invalide.
function lireId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}



// ===== Bloc 5 : les gardiens de TOUTES les routes de ce fichier =====
// router.use applique les gardiens à chaque route définie en dessous.
// 1) exigerRole : seul un commerçant connecté passe.
// 2) chargerBoutique : retrouve sa boutique, et la met dans req.boutiqueId.
function chargerBoutique(req, res, next) {
  const boutique = trouverBoutique.get(req.session.utilisateurId);
  if (!boutique) {
    return res.status(404).json({ erreurs: ["Crée d'abord ta boutique."] });
  }
  req.boutiqueId = boutique.id;
  next();
}

router.use(exigerRole('commercant'), chargerBoutique);


// ===== Bloc 6 : GET / (lister mes produits) =====
router.get('/', (req, res) => {
  const produits = listerProduits.all(req.boutiqueId).map(formater);
  return res.json({ produits });
});



// ===== Bloc 7 : POST / (ajouter un produit) =====
router.post('/', (req, res) => {
  const donnees = req.body || {};

  const erreurs = validerProduit(donnees);
  if (erreurs.length > 0) {
    return res.status(400).json({ erreurs });
  }

  try {
    const resultat = insererProduit.run(
      req.boutiqueId,
      donnees.nom.trim(),
      (donnees.description || '').trim(),
      Math.round(donnees.prix * FACTEUR),            // 1.5 devient 150
      donnees.disponible === false ? 0 : 1           // par défaut : disponible
    );

    // 201 = "créé"
    return res.status(201).json({
      message: 'Produit ajouté.',
      produit: formater(lireProduit.get(resultat.lastInsertRowid, req.boutiqueId))
    });
  } catch (erreur) {
    console.error('Erreur ajout produit :', erreur);
    return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
  }
});



// ===== Bloc 8 : PUT /:id (modifier un produit) =====
router.put('/:id', (req, res) => {
  const id = lireId(req);
  if (id === null) {
    return res.status(404).json({ erreurs: ['Produit introuvable.'] });
  }

  const donnees = req.body || {};
  const erreurs = validerProduit(donnees);
  if (erreurs.length > 0) {
    return res.status(400).json({ erreurs });
  }

  try {
    const resultat = modifierProduit.run(
      donnees.nom.trim(),
      (donnees.description || '').trim(),
      Math.round(donnees.prix * FACTEUR),
      donnees.disponible === false ? 0 : 1,
      id,
      req.boutiqueId       // ← la condition qui protège les autres boutiques
    );

    // changes = nombre de lignes modifiées. 0 = ce produit n'existe pas dans TA boutique.
    // On répond 404 (et non 403) : on ne révèle pas qu'il existe chez quelqu'un d'autre.
    if (resultat.changes === 0) {
      return res.status(404).json({ erreurs: ['Produit introuvable.'] });
    }

    return res.json({
      message: 'Produit modifié.',
      produit: formater(lireProduit.get(id, req.boutiqueId))
    });
  } catch (erreur) {
    console.error('Erreur modification produit :', erreur);
    return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
  }
});



// ===== Bloc 9 : DELETE /:id (supprimer un produit) =====
router.delete('/:id', (req, res) => {
  const id = lireId(req);
  if (id === null) {
    return res.status(404).json({ erreurs: ['Produit introuvable.'] });
  }

  try {
    const resultat = supprimerProduit.run(id, req.boutiqueId);

    if (resultat.changes === 0) {
      return res.status(404).json({ erreurs: ['Produit introuvable.'] });
    }

    return res.json({ message: 'Produit supprimé.' });
  } catch (erreur) {
    console.error('Erreur suppression produit :', erreur);
    return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
  }
});



// ===== Bloc 10 : partager le router =====
module.exports = router;