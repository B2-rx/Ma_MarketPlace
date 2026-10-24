/* ===== Bloc 1 : importer les outils ===== */
const express = require('express');
const db = require('../db');
const { exigerRole } = require('../middlewares/auth');

const router = express.Router();


/* ===== Bloc 2 : réglages ===== */

// 🔧 À MODIFIER : quantité maximale d'un même produit dans un panier
const QUANTITE_MAX = 20;


/* ===== Bloc 3 : requêtes SQL préparées ===== */

// Retrouve le produit et sa boutique
const lireProduit = db.prepare(`
  SELECT id, boutique_id, disponible FROM produits WHERE id = ?
`);

/*
  Quelle boutique le panier contient-il déjà ?
  On remonte de la ligne au produit, puis du produit à la boutique.
  LIMIT 1 suffit : toutes les lignes viennent de la même boutique.
*/
const boutiqueDuPanier = db.prepare(`
  SELECT b.id, b.nom
  FROM panier_lignes l
  JOIN produits p ON p.id = l.produit_id
  JOIN boutiques b ON b.id = p.boutique_id
  WHERE l.utilisateur_id = ?
  LIMIT 1
`);

// Quantité déjà présente pour ce produit (undefined s'il n'y est pas)
const lireLigne = db.prepare(`
  SELECT quantite FROM panier_lignes
  WHERE utilisateur_id = ? AND produit_id = ?
`);

/*
  Upsert : crée la ligne, ou remplace sa quantité si elle existe déjà.
  "excluded.quantite" = la valeur qu'on essayait d'insérer.
*/
const enregistrerLigne = db.prepare(`
  INSERT INTO panier_lignes (utilisateur_id, produit_id, quantite)
  VALUES (?, ?, ?)
  ON CONFLICT(utilisateur_id, produit_id) DO UPDATE SET
    quantite = excluded.quantite
`);


/* ===== Bloc 4 : validation ===== */

// Renvoie la liste des problèmes trouvés (liste vide = tout est correct)
function validerAjout(donnees) {
  const erreurs = [];
  const { produitId, quantite } = donnees;

  // Number.isInteger refuse le texte ("3"), les décimaux (1.5) et les valeurs absentes
  if (!Number.isInteger(produitId) || produitId < 1) {
    erreurs.push('Produit invalide.');
  }

  if (!Number.isInteger(quantite) || quantite < 1 || quantite > QUANTITE_MAX) {
    erreurs.push(`Quantité invalide (entier de 1 à ${QUANTITE_MAX}).`);
  }

  return erreurs;
}


/* ===== Bloc 5 : les gardiens de TOUTES les routes de ce fichier ===== */

// Seul un client connecté passe : un commerçant reçoit 403, un visiteur 401
router.use(exigerRole('client'));


/* ===== Bloc 6 : POST /lignes (ajouter un produit au panier) ===== */

/*
  Corps attendu : { "produitId": 3, "quantite": 2 }
  Pas de try/catch : une erreur imprévue est attrapée par le gestionnaire
  d'erreurs global de server.js et reste en JSON.
*/
router.post('/lignes', (req, res) => {
  const donnees = req.body || {};

  const erreurs = validerAjout(donnees);
  if (erreurs.length > 0) {
    return res.status(400).json({ erreurs });
  }

  // L'identité vient de la SESSION, jamais de la requête
  const utilisateurId = req.session.utilisateurId;

  // Le produit doit exister ET être disponible
  const produit = lireProduit.get(donnees.produitId);
  if (!produit || produit.disponible !== 1) {
    return res.status(404).json({ erreurs: ['Produit introuvable ou indisponible.'] });
  }

  /*
    RÈGLE MÉTIER : un seul établissement par panier.
    409 = "conflit" avec l'état actuel du panier. Le champ "conflit" permet
    au frontend d'afficher l'alerte avec le nom de la boutique.
  */
  const boutiqueActuelle = boutiqueDuPanier.get(utilisateurId);

  if (boutiqueActuelle && boutiqueActuelle.id !== produit.boutique_id) {
    return res.status(409).json({
      erreurs: [
        `Ton panier contient déjà des produits de « ${boutiqueActuelle.nom} ». `
        + 'Vide-le pour commander dans une autre boutique.'
      ],
      conflit: { boutiqueId: boutiqueActuelle.id, boutiqueNom: boutiqueActuelle.nom }
    });
  }

  // Les quantités s'additionnent : 2 déjà présents + 3 ajoutés = 5
  const ligne = lireLigne.get(utilisateurId, produit.id);
  const nouvelleQuantite = (ligne ? ligne.quantite : 0) + donnees.quantite;

  if (nouvelleQuantite > QUANTITE_MAX) {
    return res.status(400).json({
      erreurs: [`Quantité maximale : ${QUANTITE_MAX} par produit (tu en as déjà ${ligne ? ligne.quantite : 0}).`]
    });
  }

  enregistrerLigne.run(utilisateurId, produit.id, nouvelleQuantite);

  return res.json({
    message: 'Produit ajouté au panier.',
    ligne: { produitId: produit.id, quantite: nouvelleQuantite }
  });
});


/* ===== Bloc 7 : partager le router ===== */
module.exports = router;