/* a faire : c) branche les deux routes. Le limiteur 
se place entre l’adresse et la fonction, comme un gardien 
installer express-rate-limit dans le powershell 
*/


// Compteur de requêtes par adresse IP
const { rateLimit } = require('express-rate-limit');


// ===== Bloc 1 : importer les outils =====
const express = require('express');
const bcrypt = require('bcryptjs');   // pour hacher les mots de passe
const db = require('../db');          // ".." = remonter d'un dossier, vers Back_end

// Un "router" est un mini-serveur : il regroupe des routes qu'on branchera
// ensuite dans server.js.
const router = express.Router();



/* ===== Bloc 2 : réglages =====
  Coût du hachage : plus il est élevé, plus le calcul est lent (donc plus
  difficile à attaquer). 10 est un bon équilibre pour apprendre.
  🔧 À MODIFIER : 12 est plus sûr en production, mais plus lent.
*/
const COUT_HACHAGE = 10;

/* ===== Bloc 2bis : limiteurs d'essais ===== */

/*
  Limiteur de connexion : 5 échecs maximum par tranche de 15 minutes
  et par adresse IP.
  🔧 À MODIFIER : change "limit" (nombre d'essais) ou "windowMs" (durée en ms).
*/
const limiteurConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,

  /*
    Les connexions RÉUSSIES ne comptent pas : seuls les échecs (codes 400 et plus)
    remplissent le compteur. Un vrai utilisateur n'est donc jamais bloqué.
  */
  skipSuccessfulRequests: true,

  // Envoie des en-têtes standard qui indiquent le nombre d'essais restants
  standardHeaders: 'draft-7',
  legacyHeaders: false,

  // Réponse au même format que le reste de l'API (le code est 429 par défaut)
  message: { erreurs: ['Trop de tentatives. Réessaie dans quelques minutes.'] }
});

/*
  Limiteur d'inscription : 20 requêtes par heure et par adresse IP.
  Large exprès : on refait souvent les tests en développement.
  🔧 À MODIFIER : en production, descends à 5 ou 10.
*/
const limiteurInscription = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erreurs: ['Trop de créations de compte. Réessaie plus tard.'] }
});



// ===== Bloc 3 : requête SQL préparée =====
// Les "?" seront remplacés par les vraies valeurs au moment de l'exécution.
// La base traite ces valeurs comme du simple TEXTE, jamais comme du code SQL.
// 🔧 DÉBOGAGE : si tu ajoutes une colonne à la table, ajoute-la ici
// ET ajoute un "?" correspondant.
const insererUtilisateur = db.prepare(`
  INSERT INTO utilisateurs (email, telephone, mot_de_passe_hash, role)
  VALUES (?, ?, ?, ?)
`);

// Cherche un compte par email (on a besoin du hash pour comparer le mot de passe)
const trouverParEmail = db.prepare(`
  SELECT id, email, mot_de_passe_hash, role FROM utilisateurs WHERE email = ?
`);

// Cherche un compte par id (SANS le hash : on ne le sort de la base que si nécessaire)
const trouverParId = db.prepare(`
  SELECT id, email, telephone, role FROM utilisateurs WHERE id = ?
`);

// Hash "leurre", utilisé quand l'email n'existe pas.
// Pourquoi ? Comparer un hash prend du temps. Sans leurre, un email inconnu
// recevrait une réponse instantanée, et un attaquant pourrait deviner quels
// emails ont un compte en chronométrant le serveur.
const HASH_FICTIF = bcrypt.hashSync('mot-de-passe-fictif', COUT_HACHAGE);



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
    !/^\+?[0-9 .-]{8,25}$/.test(telephone.trim())
  ) {
    erreurs.push('Téléphone invalide (8 à 25 chiffres, "+" autorisé au début).');
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
router.post('/inscription', limiteurInscription, async (req, res) => {

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

// ===== Bloc 5bis : la route POST /connexion =====
router.post('/connexion', limiteurConnexion, async (req, res) => {
  const { email, motDePasse } = req.body || {};

  // Vérification minimale : on ne fait pas confiance au type des données reçues
  if (typeof email !== 'string' || typeof motDePasse !== 'string' || motDePasse.length > 72) {
    return res.status(400).json({ erreurs: ['Email et mot de passe requis.'] });
  }

  try {
    // On cherche le compte (même nettoyage que pour l'inscription)
    const utilisateur = trouverParEmail.get(email.trim().toLowerCase());

    // On compare TOUJOURS un hash, réel ou leurre, pour que le temps de réponse reste le même
    const hash = utilisateur ? utilisateur.mot_de_passe_hash : HASH_FICTIF;
    const motDePasseValide = await bcrypt.compare(motDePasse, hash);

    // Même message dans les deux cas : on ne révèle pas si l'email existe.
    // 401 = "non authentifié".
    if (!utilisateur || !motDePasseValide) {
      return res.status(401).json({ erreurs: ['Email ou mot de passe incorrect.'] });
    }

    // regenerate = crée un NOUVEL identifiant de session à la connexion.
    // Cela empêche une attaque où un tiers aurait imposé un identifiant à l'avance.
    req.session.regenerate((erreur) => {
      if (erreur) {
        console.error('Erreur session :', erreur);
        return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
      }

      // On range dans la session le minimum : l'id et le rôle
      req.session.utilisateurId = utilisateur.id;
      req.session.role = utilisateur.role;

      return res.json({
        message: 'Connexion réussie.',
        utilisateur: { id: utilisateur.id, email: utilisateur.email, role: utilisateur.role }
      });
    });
  } catch (erreur) {
    console.error('Erreur connexion :', erreur);
    return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
  }
});

// ===== Bloc 5ter : la route GET /moi =====
// "Qui suis-je ?" Le frontend l'utilisera pour savoir si quelqu'un est connecté.
router.get('/moi', (req, res) => {
  // Pas de badge dans la session : non connecté
  if (!req.session.utilisateurId) {
    return res.status(401).json({ erreurs: ['Non connecté.'] });
  }

  const utilisateur = trouverParId.get(req.session.utilisateurId);

  // Le compte n'existe plus en base : la session est périmée, on la détruit
  if (!utilisateur) {
    return req.session.destroy(() => {
      res.status(401).json({ erreurs: ['Non connecté.'] });
    });
  }

  return res.json({ utilisateur });
});

// ===== Bloc 5quater : la route POST /deconnexion =====
router.post('/deconnexion', (req, res) => {
  // destroy = supprime la fiche de session côté serveur
  req.session.destroy(() => {
    // On supprime aussi le cookie côté navigateur ("connect.sid" = nom par défaut)
    res.clearCookie('connect.sid');
    return res.json({ message: 'Déconnexion réussie.' });
  });
});

// ===== Bloc 6 : partager le router =====
module.exports = router;


