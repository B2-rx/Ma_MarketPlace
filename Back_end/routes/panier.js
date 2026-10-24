/* ===== Bloc 1 : importer les outils ===== */
const express = require('express');
const db = require('../db');
const { exigerRole } = require('../middlewares/auth');
const { FACTEUR } = require('../constantes');
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

/*
  Tout le panier d'un client, avec les infos du produit et de la boutique.
  Les prix viennent de la BASE : le client n'a aucun moyen de les modifier.
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

/*
  Les trois requêtes ci-dessous filtrent TOUJOURS sur utilisateur_id,
  qui vient de la session : un client ne peut jamais toucher au panier d'un autre.
*/
const modifierQuantite = db.prepare(`
  UPDATE panier_lignes SET quantite = ?
  WHERE utilisateur_id = ? AND produit_id = ?
`);

const retirerLigne = db.prepare(`
  DELETE FROM panier_lignes
  WHERE utilisateur_id = ? AND produit_id = ?
`);

const viderPanier = db.prepare(`
  DELETE FROM panier_lignes WHERE utilisateur_id = ?
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

// Vérifie une quantité seule (utilisée par la modification)
function validerQuantite(quantite) {
  if (!Number.isInteger(quantite) || quantite < 1 || quantite > QUANTITE_MAX) {
    return [`Quantité invalide (entier de 1 à ${QUANTITE_MAX}).`];
  }

  return [];
}

// Lit le produitId dans l'adresse. Renvoie null s'il est invalide.
function lireProduitId(req) {
  const id = Number(req.params.produitId);

  return Number.isInteger(id) && id > 0 ? id : null;
}

/*
  Transforme les lignes de la base en réponse lisible.
  Les calculs se font en ENTIERS (150), la conversion (1.5) vient à la fin.
*/
function formaterPanier(lignes) {
  if (lignes.length === 0) {
    return { boutique: null, lignes: [], total: 0, nombreArticles: 0, commandable: false };
  }

  let totalEntier = 0;
  let nombreArticles = 0;

  const lignesFormatees = lignes.map((ligne) => {
    const sousTotalEntier = ligne.prix_entier * ligne.quantite;

    totalEntier += sousTotalEntier;
    nombreArticles += ligne.quantite;

    return {
      produitId: ligne.produit_id,
      nom: ligne.nom,
      prix: ligne.prix_entier / FACTEUR,
      quantite: ligne.quantite,
      sousTotal: sousTotalEntier / FACTEUR,
      disponible: ligne.disponible === 1
    };
  });

  return {
    // Toutes les lignes viennent de la même boutique (règle de l'étape 16)
    boutique: { id: lignes[0].boutique_id, nom: lignes[0].boutique_nom },
    lignes: lignesFormatees,
    total: totalEntier / FACTEUR,
    nombreArticles,

    // false si un produit est passé en rupture depuis son ajout
    commandable: lignes.every((ligne) => ligne.disponible === 1)
  };
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

/* ===== Bloc 6bis : GET / (consulter le panier) ===== */
router.get('/', (req, res) => {
  const lignes = lirePanier.all(req.session.utilisateurId);

  return res.json({ panier: formaterPanier(lignes) });
});


/* ===== Bloc 6ter : PUT /lignes/:produitId (changer une quantité) ===== */

/*
  Corps attendu : { "quantite": 4 }
  La quantité REMPLACE l'ancienne (contrairement à l'ajout, qui additionne).
*/
router.put('/lignes/:produitId', (req, res) => {
  const produitId = lireProduitId(req);

  if (produitId === null) {
    return res.status(404).json({ erreurs: ['Produit absent de ton panier.'] });
  }

  const quantite = (req.body || {}).quantite;
  const erreurs = validerQuantite(quantite);

  if (erreurs.length > 0) {
    return res.status(400).json({ erreurs });
  }

  const resultat = modifierQuantite.run(quantite, req.session.utilisateurId, produitId);

  // changes = 0 : ce produit n'est pas dans le panier de CE client
  if (resultat.changes === 0) {
    return res.status(404).json({ erreurs: ['Produit absent de ton panier.'] });
  }

  return res.json({
    message: 'Quantité modifiée.',
    ligne: { produitId, quantite }
  });
});


/* ===== Bloc 6quater : DELETE /lignes/:produitId (retirer un produit) ===== */
router.delete('/lignes/:produitId', (req, res) => {
  const produitId = lireProduitId(req);

  if (produitId === null) {
    return res.status(404).json({ erreurs: ['Produit absent de ton panier.'] });
  }

  const resultat = retirerLigne.run(req.session.utilisateurId, produitId);

  if (resultat.changes === 0) {
    return res.status(404).json({ erreurs: ['Produit absent de ton panier.'] });
  }

  return res.json({ message: 'Produit retiré du panier.' });
});


/* ===== Bloc 6quinquies : DELETE / (vider le panier) ===== */

/*
  Répond 200 même si le panier était déjà vide : le résultat voulu
  (un panier vide) est atteint dans les deux cas.
*/
router.delete('/', (req, res) => {
  const resultat = viderPanier.run(req.session.utilisateurId);

  return res.json({
    message: 'Panier vidé.',
    lignesSupprimees: resultat.changes
  });
});


/* ===== Bloc 7 : partager le router ===== */
module.exports = router;