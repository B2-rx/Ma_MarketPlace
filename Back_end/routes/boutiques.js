/* ===== Bloc 1 : importer les outils ===== */
const express = require('express');
const db = require('../db');

const fs = require('fs');           // lire, écrire et supprimer des fichiers
const path = require('path');       // fabriquer des chemins sans erreur
const crypto = require('crypto');   // générer des noms aléatoires
const multer = require('multer');   // décoder les envois de fichiers

// Notre gardien : il bloque les comptes qui n'ont pas le bon rôle
const { exigerRole } = require('../middlewares/auth');
const { SECTEURS } = require('../constantes'); // 
const router = express.Router();


/* ===== Bloc 2 : réglages ===== */

// Dossier des images : Back_end/uploads (".." remonte de routes/ vers Back_end)
const DOSSIER_UPLOADS = path.join(__dirname, '..', 'uploads');

// Crée le dossier s'il n'existe pas (recursive : pas d'erreur s'il existe déjà)
fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true });

// 🔧 À MODIFIER : taille maximale d'une image, en octets (ici 2 Mo)
const TAILLE_MAX = 2 * 1024 * 1024;

/*
  Multer configuré en mémoire : le fichier reste dans req.file.buffer
  et n'est PAS écrit sur le disque. On ne l'écrit qu'après l'avoir vérifié.
*/
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX, files: 1 }
});


/* ===== Bloc 3 : requêtes SQL préparées ===== */

// Lire la boutique d'un commerçant
const lireBoutique = db.prepare(`
  SELECT id, nom, description, secteur, image_chemin
  FROM boutiques WHERE utilisateur_id = ?
`);

/*
  "Upsert" = INSERT si la boutique n'existe pas, sinon UPDATE.
  ON CONFLICT(utilisateur_id) : la boutique existe déjà pour ce commerçant.
  "excluded" désigne les valeurs qu'on essayait d'insérer.
  ⚠️ image_chemin n'est PAS dans la liste : modifier le texte
  ne supprime pas l'image.
*/
const enregistrerBoutique = db.prepare(`
  INSERT INTO boutiques (utilisateur_id, nom, description, secteur)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(utilisateur_id) DO UPDATE SET
    nom = excluded.nom,
    description = excluded.description,
    secteur = excluded.secteur
`);

// Met à jour uniquement le chemin de l'image d'une boutique
const mettreAJourImage = db.prepare(`
  UPDATE boutiques SET image_chemin = ? WHERE utilisateur_id = ?
`);


/* ===== Bloc 4 : validation ===== */

// Renvoie la liste des problèmes trouvés (liste vide = tout est correct)
function validerBoutique(donnees) {
  const erreurs = [];
  const { nom, description, secteur } = donnees;

  // Nom : texte de 2 à 60 caractères (espaces inutiles retirés)
  if (typeof nom !== 'string' || nom.trim().length < 2 || nom.trim().length > 60) {
    erreurs.push('Nom invalide (2 à 60 caractères).');
  }

  // Description : facultative, mais si elle est présente : texte de 500 caractères max
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


/* ===== Bloc 4bis : outils pour l'upload ===== */

/*
  Devine le VRAI type d'une image en lisant ses premiers octets.
  Le nom et le type annoncés par l'utilisateur sont falsifiables,
  le contenu ne ment pas.
  Renvoie l'extension à utiliser, ou null si le format est refusé.
*/
function detecterExtension(buffer) {
  if (buffer.length < 12) return null;

  // JPEG : commence par FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return '.jpg';
  }

  // PNG : commence par 89 50 4E 47 0D 0A 1A 0A
  const signaturePng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (buffer.subarray(0, 8).equals(signaturePng)) {
    return '.png';
  }

  // WebP : "RIFF" aux octets 0 à 3, puis "WEBP" aux octets 8 à 11
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return '.webp';
  }

  return null;
}

// Enveloppe multer pour renvoyer nos propres messages d'erreur
function recevoirImage(req, res, next) {
  // "image" = nom du champ du formulaire qui contient le fichier
  upload.single('image')(req, res, (erreur) => {
    if (!erreur) return next();

    // 413 = "contenu trop volumineux"
    if (erreur.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ erreurs: ['Image trop lourde (2 Mo maximum).'] });
    }

    return res.status(400).json({ erreurs: ['Envoi du fichier invalide.'] });
  });
}


/* ===== Bloc 5 : GET /ma-boutique ===== */

// exigerRole passe AVANT la fonction : un client reçoit 403
router.get('/ma-boutique', exigerRole('commercant'), (req, res) => {
  // L'id vient de la SESSION, jamais de la requête
  const boutique = lireBoutique.get(req.session.utilisateurId);

  // .get() renvoie undefined s'il n'y a rien : pas encore de boutique
  if (!boutique) {
    return res.status(404).json({ erreurs: ["Tu n'as pas encore créé ta boutique."] });
  }

  return res.json({ boutique });
});


/* ===== Bloc 6 : PUT /ma-boutique ===== */

// PUT = "remplacer / mettre à jour" : même route pour créer et modifier
router.put('/ma-boutique', exigerRole('commercant'), (req, res) => {
  const donnees = req.body || {};

  const erreurs = validerBoutique(donnees);
  if (erreurs.length > 0) {
    return res.status(400).json({ erreurs });
  }

  try {
    // On ne retient que les trois champs attendus : tout autre champ est ignoré
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


/* ===== Bloc 6bis : POST /ma-boutique/image ===== */

/*
  Ordre des gardiens : 1) rôle commerçant, 2) réception du fichier.
  Un visiteur ou un client est donc refusé AVANT que son fichier soit lu.
*/
router.post('/ma-boutique/image', exigerRole('commercant'), recevoirImage, (req, res) => {
  // Aucun fichier dans le champ "image"
  if (!req.file) {
    return res.status(400).json({ erreurs: ['Aucun fichier reçu (champ "image" attendu).'] });
  }

  // La boutique doit exister avant d'avoir une image
  const boutique = lireBoutique.get(req.session.utilisateurId);
  if (!boutique) {
    return res.status(404).json({ erreurs: ["Crée d'abord ta boutique."] });
  }

  // On vérifie le contenu réel du fichier
  const extension = detecterExtension(req.file.buffer);
  if (!extension) {
    return res.status(400).json({ erreurs: ['Format refusé : JPEG, PNG ou WebP uniquement.'] });
  }

  try {
    /*
      Nom ALÉATOIRE (32 caractères) + extension déduite du contenu.
      Le nom envoyé par l'utilisateur n'est jamais utilisé.
    */
    const nomFichier = crypto.randomBytes(16).toString('hex') + extension;

    // Le fichier n'est écrit sur le disque qu'à cet instant, une fois validé
    fs.writeFileSync(path.join(DOSSIER_UPLOADS, nomFichier), req.file.buffer);

    // En base : uniquement le CHEMIN, jamais l'image
    const ancienChemin = boutique.image_chemin;
    mettreAJourImage.run('uploads/' + nomFichier, req.session.utilisateurId);

    /*
      Supprime l'ancienne image pour ne pas accumuler de fichiers inutiles.
      path.basename ne garde que le nom : aucun risque de sortir du dossier.
    */
    if (ancienChemin) {
      try {
        fs.unlinkSync(path.join(DOSSIER_UPLOADS, path.basename(ancienChemin)));
      } catch (e) {
        // Fichier déjà absent : sans importance
      }
    }

    return res.json({
      message: 'Image enregistrée.',
      boutique: lireBoutique.get(req.session.utilisateurId)
    });
  } catch (erreur) {
    console.error('Erreur upload :', erreur);
    return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
  }
});


/* ===== Bloc 7 : partager le router ===== */
module.exports = router;