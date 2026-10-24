/* ===== Bloc 1 : importer les outils ===== */
const db = require('../db');


/* ===== Bloc 2 : requête SQL préparée ===== */

// Retrouve la boutique du commerçant connecté
const trouverBoutique = db.prepare(`SELECT id FROM boutiques WHERE utilisateur_id = ?`);


/* ===== Bloc 3 : le gardien ===== */

/*
  À placer APRÈS exigerRole('commercant').
  Il met l'id de la boutique dans req.boutiqueId : les routes l'utiliseront
  pour filtrer leurs requêtes. L'id vient de la SESSION, jamais de la requête.
*/
function chargerBoutique(req, res, next) {
  const boutique = trouverBoutique.get(req.session.utilisateurId);

  if (!boutique) {
    return res.status(404).json({ erreurs: ["Crée d'abord ta boutique."] });
  }

  req.boutiqueId = boutique.id;
  next();
}


/* ===== Bloc 4 : partager le gardien ===== */
module.exports = { chargerBoutique };