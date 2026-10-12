// ===== Bloc 1 : importer les outils =====
const express = require('express');
const bcrypt = require('bcryptjs');   // pour hacher les mots de passe
const db = require('../db');          // ".." = remonter d'un dossier, vers Back_end

// Un "router" est un mini-serveur : il regroupe des routes qu'on branchera
// ensuite dans server.js.
const router = express.Router();

// ===== Bloc 2 : réglages =====
// Coût du hachage : plus il est élevé, plus le calcul est lent (donc plus
// difficile à attaquer). 10 est un bon équilibre pour apprendre.
// 🔧 À MODIFIER : 12 est plus sûr en production, mais plus lent.
const COUT_HACHAGE = 10;

// ===== Bloc 3 : requête SQL préparée =====
// Les "?" seront remplacés par les vraies valeurs au moment de l'exécution.
// La base traite ces valeurs comme du simple TEXTE, jamais comme du code SQL.
// 🔧 DÉBOGAGE : si tu ajoutes une colonne à la table, ajoute-la ici
// ET ajoute un "?" correspondant.
const insererUtilisateur = db.prepare(`
  INSERT INTO utilisateurs (email, telephone, mot_de_passe_hash, role)
  VALUES (?, ?, ?, ?)
`);

// ===== Bloc 4 : fonction de validation =====
// Elle vérifie les données reçues et renvoie la liste des problèmes trouvés.
// Liste vide = tout est correct.
function validerInscription(donnees) {
  const erreurs = [];
  const { email, telephone, motDePasse, role } = donnees;

  // Email : doit être du texte, de forme "xxx@yyy.zz", et pas trop long
  if (
    typeof email !== 'string' ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    erreurs.push('Email invalide.');
  }

  // Téléphone : chiffres, espaces, points ou tirets, "+" optionnel au début
  // 🔧 À MODIFIER : adapte cette règle à ton pays si besoin.
  if (
    typeof telephone !== 'string' ||
    !/^\+?[0-9 .-]{8,20}$/.test(telephone.trim())
  ) {
    erreurs.push('Téléphone invalide (8 à 20 chiffres, "+" autorisé au début).');
  }

  // Mot de passe : 8 caractères minimum, au moins une lettre et un chiffre.
  // Maximum 72 : bcrypt ignore tout ce qui dépasse ce seuil.
  if (
    typeof motDePasse !== 'string' ||
    motDePasse.length < 8 ||
    motDePasse.length > 72 ||
    !/[A-Za-z]/.test(motDePasse) ||
    !/[0-9]/.test(motDePasse)
  ) {
    erreurs.push('Mot de passe invalide (8 à 72 caractères, avec au moins une lettre et un chiffre).');
  }

  // Rôle : uniquement l'une de ces deux valeurs
  if (role !== 'client' && role !== 'commercant') {
    erreurs.push('Rôle invalide ("client" ou "commercant").');
  }

  return erreurs;
}

// ===== Bloc 5 : la route POST /inscription =====
// POST = "envoyer des données pour créer quelque chose".
// L'adresse complète sera /api/auth/inscription (le début est défini dans server.js).
router.post('/inscription', async (req, res) => {
  // req.body contient le JSON envoyé. "|| {}" évite un plantage s'il est absent.
  const donnees = req.body || {};

  // --- 5a : valider ---
  const erreurs = validerInscription(donnees);
  if (erreurs.length > 0) {
    // 400 = "requête incorrecte" : l'utilisateur a envoyé de mauvaises données
    return res.status(400).json({ erreurs });
  }

  try {
    // --- 5b : nettoyer ---
    // On met l'email en minuscules : "Alice@x.com" et "alice@x.com"
    // doivent être le même compte.
    const email = donnees.email.trim().toLowerCase();
    const telephone = donnees.telephone.trim();

    // --- 5c : hacher le mot de passe ---
    // "await" = attendre la fin du calcul (volontairement un peu lent).
    const hash = await bcrypt.hash(donnees.motDePasse, COUT_HACHAGE);

    // --- 5d : enregistrer en base ---
    const resultat = insererUtilisateur.run(email, telephone, hash, donnees.role);

    // --- 5e : répondre ---
    // 201 = "créé avec succès".
    // ⚠️ On ne renvoie JAMAIS le hash ni le mot de passe.
    return res.status(201).json({
      message: 'Compte créé avec succès.',
      utilisateur: { id: resultat.lastInsertRowid, email, role: donnees.role }
    });
  } catch (erreur) {
    // L'email existe déjà : la contrainte UNIQUE de la base a refusé l'insertion
    if (erreur.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // 409 = "conflit" avec une donnée existante
      return res.status(409).json({ erreurs: ['Un compte existe déjà avec cet email.'] });
    }

    // Toute autre erreur : on la note dans le terminal (pour toi),
    // mais on ne montre PAS les détails à l'utilisateur.
    console.error('Erreur inscription :', erreur);
    return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
  }
});

// ===== Bloc 6 : partager le router =====
module.exports = router;