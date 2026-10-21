// ===== Bloc 1 : importer les outils =====
const express = require('express');
const db = require('../db');
// Notre gardien de l'étape précédente
const { exigerRole } = require('../middlewares/auth');

const router = express.Router();



// ===== Bloc 2 : réglages =====
// Liste des secteurs autorisés. Le client enverra l'un d'eux, jamais un texte libre.
// 🔧 À MODIFIER : pour ajouter un secteur, ajoute-le ici (un seul endroit à changer).
const SECTEURS = ['restauration', 'boulangerie', 'epicerie', 'boissons', 'autre'];

// ===== Bloc 3 : requêtes SQL préparées =====
// Lire la boutique d'un commerçant
const lireBoutique = db.prepare(`
  SELECT id, nom, description, secteur, image_chemin
  FROM boutiques WHERE utilisateur_id = ?
`);

// "Upsert" = INSERT si elle n'existe pas, sinon UPDATE.
// ON CONFLICT(utilisateur_id) : la boutique existe déjà pour ce commerçant.
// "excluded" désigne les valeurs qu'on essayait d'insérer.
// ⚠️ image_chemin n'est PAS dans la liste : modifier le texte ne supprime pas l'image.
const enregistrerBoutique = db.prepare(`
  INSERT INTO boutiques (utilisateur_id, nom, description, secteur)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(utilisateur_id) DO UPDATE SET
    nom = excluded.nom,
    description = excluded.description,
    secteur = excluded.secteur
`);

// ===== Bloc 4 : validation =====
function validerBoutique(donnees) {
  const erreurs = [];
  const { nom, description, secteur } = donnees;

  // Nom : texte de 2 à 60 caractères (espaces inutiles retirés)
  if (typeof nom !== 'string' || nom.trim().length < 2 || nom.trim().length > 60) {
    erreurs.push('Nom invalide (2 à 60 caractères).');
  }

  // Description : facultative, mais si elle est présente, c'est du texte de 500 caractères max
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.trim().length > 500) {
      erreurs.push('Description invalide (500 caractères maximum).');
    }
  }

  // Secteur : obligatoirement l'une des valeurs de la liste
  if (!SECTEURS.includes(secteur)) {
    erreurs.push(`Secteur invalide (choisis parmi : ${SECTEURS.join(', ')}).`);
  }

  return erreurs;
}

// ===== Bloc 5 : GET /ma-boutique =====
// exigerRole('commercant') passe AVANT la fonction : un client reçoit 403.
router.get('/ma-boutique', exigerRole('commercant'), (req, res) => {
  // L'id vient de la SESSION, pas de la requête
  const boutique = lireBoutique.get(req.session.utilisateurId);

  // .get() renvoie undefined s'il n'y a rien : le commerçant n'a pas encore de boutique
  if (!boutique) {
    return res.status(404).json({ erreurs: ["Tu n'as pas encore créé ta boutique."] });
  }

  return res.json({ boutique });
});

// ===== Bloc 6 : PUT /ma-boutique =====
// PUT = "remplacer / mettre à jour". Même route pour créer et modifier.
router.put('/ma-boutique', exigerRole('commercant'), (req, res) => {
  const donnees = req.body || {};

  const erreurs = validerBoutique(donnees);
  if (erreurs.length > 0) {
    return res.status(400).json({ erreurs });
  }

  try {
    // On ne retient que les trois champs attendus : tout autre champ envoyé est ignoré
    enregistrerBoutique.run(
      req.session.utilisateurId,
      donnees.nom.trim(),
      (donnees.description || '').trim(),
      donnees.secteur
    );

    return res.json({
      message: 'Boutique enregistrée.',
      boutique: lireBoutique.get(req.session.utilisateurId)
    });
  } catch (erreur) {
    console.error('Erreur boutique :', erreur);
    return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
  }
});

// ===== Bloc 7 : partager le router =====
module.exports = router;