// ===== Gardien 1 : "il faut être connecté" =====
// Un middleware reçoit trois choses :
//   req  = la requête, res = la réponse,
//   next = une fonction qui dit "c'est bon, passe à la suite".
function exigerConnexion(req, res, next) {
  // Pas de badge (identifiant) dans la session : on bloque
  if (!req.session.utilisateurId) {
    // 401 = "non authentifié" : on ne sait pas qui tu es
    return res.status(401).json({ erreurs: ['Connexion requise.'] });
  }

  // Tout va bien : on laisse la requête continuer vers la route
  next();
}

// ===== Gardien 2 : "il faut avoir tel rôle" =====
// Cette fonction FABRIQUE un gardien selon le rôle demandé.
// Usage : exigerRole('commercant')
// 🔧 À MODIFIER : si tu ajoutes un rôle un jour (ex. 'admin'), il n'y a rien à changer ici.
function exigerRole(roleAttendu) {
  return (req, res, next) => {
    // D'abord : est-il connecté ?
    if (!req.session.utilisateurId) {
      return res.status(401).json({ erreurs: ['Connexion requise.'] });
    }

    // Connecté, mais pas le bon rôle : on bloque.
    // 403 = "interdit" : on sait qui tu es, mais tu n'as pas le droit.
    if (req.session.role !== roleAttendu) {
      return res.status(403).json({ erreurs: ['Accès refusé pour ton type de compte.'] });
    }

    next();
  };
}

// ===== Partager les deux gardiens =====
module.exports = { exigerConnexion, exigerRole };