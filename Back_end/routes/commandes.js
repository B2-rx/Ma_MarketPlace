/* ===== Bloc 1 : importer les outils ===== */
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const { exigerRole } = require('../middlewares/auth');
const { FACTEUR, STATUT_INITIAL } = require('../constantes');

const router = express.Router();


/* ===== Bloc 2 : réglages ===== */

/*
  Limiteur de commandes : 20 requêtes par heure et par adresse IP.
  Large exprès pour les tests.
  🔧 À MODIFIER : en production, descends à 10.
*/
const limiteurCommande = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erreurs: ['Trop de commandes. Réessaie plus tard.'] }
});


/* ===== Bloc 3 : requêtes SQL préparées ===== */

/*
  Le panier du client avec les infos du produit et de la boutique.
  Les prix viennent de la BASE, jamais du client.
*/
const lirePanier = db.prepare(`
  SELECT
    p.id AS produit_id, p.nom, p.prix_entier, p.disponible,
    l.quantite,
    b.id AS boutique_id, b.nom AS boutique_nom
  FROM panier_lignes l
  JOIN produits p ON p.id = l.produit_id
  JOIN boutiques b ON b.id = p.boutique_id
  WHERE l.utilisateur_id = ?
  ORDER BY l.date_ajout, p.id
`);

const insererCommande = db.prepare(`
  INSERT INTO commandes (utilisateur_id, boutique_id, boutique_nom, statut, total_entier)
  VALUES (?, ?, ?, ?, ?)
`);

const insererLigne = db.prepare(`
  INSERT INTO commande_lignes (commande_id, produit_id, nom, prix_unitaire_entier, quantite)
  VALUES (?, ?, ?, ?, ?)
`);

const viderPanier = db.prepare(`
  DELETE FROM panier_lignes WHERE utilisateur_id = ?
`);

// Double condition : l'id de la commande ET son propriétaire
const lireCommande = db.prepare(`
  SELECT id, boutique_id, boutique_nom, statut, total_entier, date_creation
  FROM commandes
  WHERE id = ? AND utilisateur_id = ?
`);

const lireLignes = db.prepare(`
  SELECT produit_id, nom, prix_unitaire_entier, quantite
  FROM commande_lignes
  WHERE commande_id = ?
  ORDER BY id
`);


/* ===== Bloc 4 : outils ===== */

/*
  Transforme une commande de la base en réponse lisible.
  Les calculs restent en ENTIERS (150), la conversion (1.5) vient à la fin.
*/
function formaterCommande(commande, lignes) {
  return {
    id: commande.id,
    boutique: { id: commande.boutique_id, nom: commande.boutique_nom },
    statut: commande.statut,
    total: commande.total_entier / FACTEUR,

    // Format SQLite : "2026-10-24 12:30:00", en heure UTC
    dateCreation: commande.date_creation,

    lignes: lignes.map((ligne) => ({
      produitId: ligne.produit_id,
      nom: ligne.nom,
      prix: ligne.prix_unitaire_entier / FACTEUR,
      quantite: ligne.quantite,
      sousTotal: (ligne.prix_unitaire_entier * ligne.quantite) / FACTEUR
    }))
  };
}


/* ===== Bloc 5 : la transaction ===== */

/*
  db.transaction() renvoie une fonction : tout ce qu'elle contient réussit
  ensemble, ou est annulé ensemble si une erreur survient.

  Les vérifications sont faites À L'INTÉRIEUR : le panier lu ici est
  exactement celui qui sera transformé en commande.

  La fonction renvoie un objet décrivant le résultat :
    { erreurs, statutHttp }  = refus, rien n'a été écrit
    { commandeId }           = commande créée
*/
const passerCommande = db.transaction((utilisateurId) => {
  const lignes = lirePanier.all(utilisateurId);

  // Panier vide
  if (lignes.length === 0) {
    return { statutHttp: 400, erreurs: ['Ton panier est vide.'] };
  }

  // Une seule boutique (déjà garanti à l'étape 16, on revérifie par prudence)
  const boutiques = new Set(lignes.map((ligne) => ligne.boutique_id));

  if (boutiques.size !== 1) {
    return {
      statutHttp: 409,
      erreurs: ['Ton panier mélange plusieurs boutiques. Vide-le et recommence.']
    };
  }

  // Produits passés en rupture depuis leur ajout au panier
  const indisponibles = lignes.filter((ligne) => ligne.disponible !== 1);

  if (indisponibles.length > 0) {
    return {
      statutHttp: 409,
      erreurs: ['Certains produits ne sont plus disponibles. Retire-les de ton panier.'],
      indisponibles: indisponibles.map((ligne) => ({
        produitId: ligne.produit_id,
        nom: ligne.nom
      }))
    };
  }

  // Total calculé par le SERVEUR, en entiers
  let totalEntier = 0;

  lignes.forEach((ligne) => {
    totalEntier += ligne.prix_entier * ligne.quantite;
  });

  // 1) la commande
  const resultat = insererCommande.run(
    utilisateurId,
    lignes[0].boutique_id,
    lignes[0].boutique_nom,
    STATUT_INITIAL,
    totalEntier
  );

  const commandeId = resultat.lastInsertRowid;

  // 2) ses lignes, avec COPIE du nom et du prix
  lignes.forEach((ligne) => {
    insererLigne.run(commandeId, ligne.produit_id, ligne.nom, ligne.prix_entier, ligne.quantite);
  });

  // 3) le panier est vidé
  viderPanier.run(utilisateurId);

  return { commandeId };
});


/* ===== Bloc 6 : les gardiens de TOUTES les routes de ce fichier ===== */

// Seul un client connecté passe : un commerçant reçoit 403, un visiteur 401
router.use(exigerRole('client'));


/* ===== Bloc 7 : POST / (passer commande) ===== */

/*
  Aucun corps attendu : tout vient du panier enregistré côté serveur.
  Le limiteur passe AVANT la fonction, comme un gardien.
*/
router.post('/', limiteurCommande, (req, res) => {
  const utilisateurId = req.session.utilisateurId;

  const resultat = passerCommande(utilisateurId);

  // Refus : on renvoie le code et le corps préparés dans la transaction
  if (resultat.erreurs) {
    const { statutHttp, ...corps } = resultat;

    return res.status(statutHttp).json(corps);
  }

  const commande = lireCommande.get(resultat.commandeId, utilisateurId);
  const lignes = lireLignes.all(commande.id);

  // 201 = "créé"
  return res.status(201).json({
    message: 'Commande enregistrée.',
    commande: formaterCommande(commande, lignes)
  });
});


/* ===== Bloc 8 : partager le router ===== */
module.exports = router;