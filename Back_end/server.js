// Charge le fichier .env : les variables deviennent disponibles dans process.env.
// ⚠️ Doit être la TOUTE PREMIÈRE ligne, sinon les autres fichiers ne verront pas le secret.
require('dotenv').config();

// ===== Bloc 1 : importer Express =====
// "require" charge une bibliothèque installée avec npm.
// "express" est ici une fonction qui crée notre application serveur.
const express = require('express');

// Bibliothèque qui gère les sessions (le "badge" de l'utilisateur connecté)
const session = require('express-session');
// Outil intégré à Node pour fabriquer des chemins de fichiers
const path = require('path');

// Charge db.js : cela ouvre la base et crée la table au démarrage du serveur
// 🔧 DÉBOGAGE : si cette ligne provoque une erreur, le problème vient de db.js
const db = require('./db');

// Notre stockage de sessions dans SQLite
const StockageSqlite = require('./session-store');



// ===== Bloc 2 : créer l'application =====
// "app" représente notre serveur. Toutes les routes y seront ajoutées.
const app = express();

// Ne dit plus "X-Powered-By: Express" dans les réponses
app.disable('x-powered-by');


// ===== Bloc 3 : le port =====
// Le port est le "numéro de porte" sur lequel le serveur écoute.
// process.env.PORT permet à un hébergeur d'imposer son port plus tard ;
// sinon on utilise 3000.
// 🔧 À MODIFIER : change 3000 si ce port est déjà occupé sur ton ordinateur.
const PORT = process.env.PORT || 3000;



// ===== Bloc 4 : lire le JSON =====
// Les formulaires enverront des données au format JSON.
// Cette ligne permet à Express de les lire dans req.body.
// (Il faut qu'elle soit AVANT les routes.)
// Refuse les corps JSON de plus de 10 Ko (protège contre les envois géants)
app.use(express.json({ limit: '10kb' }));


// ===== Sessions =====
// Sécurité : sans clé secrète, on refuse de démarrer plutôt que d'être mal protégé.
// 🔧 DÉBOGAGE : cette erreur = le fichier .env manque ou n'est pas dans Back_end.
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET manquant : vérifie ton fichier .env');
}

app.use(session({
  // Clé qui signe le cookie (lue dans .env, jamais écrite dans le code)
  secret: process.env.SESSION_SECRET,

 // Où ranger les sessions : dans la base, plus en mémoire
  store: new StockageSqlite(db),

  // Ne réécrit pas la session si rien n'a changé
  resave: false,

  // Ne crée pas de session pour les visiteurs non connectés
  saveUninitialized: false,

  cookie: {
    // httpOnly : le JavaScript de la page ne peut pas lire le cookie (limite le vol par XSS)
    httpOnly: true,

    // lax : le cookie n'est pas envoyé lors de requêtes venant d'autres sites (limite le CSRF)
    sameSite: 'lax',

    // 🔧 À MODIFIER à la mise en ligne : mets true (HTTPS obligatoire).
    // En local on est en http, donc false.
    secure: false,

    // Durée de vie : 7 jours, en millisecondes
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));


// ===== Images envoyées =====
// Rend le dossier uploads/ accessible dans le navigateur : /uploads/mon-image.png
// Les images de boutiques sont publiques, les clients doivent pouvoir les voir.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  // nosniff : le navigateur doit respecter le type du fichier annoncé par le serveur
  // et ne pas "deviner" qu'un fichier est autre chose (protection supplémentaire).
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));



// ===== Bloc 5 : brancher les routes =====
// Branche les routes d'authentification : tout ce qui est défini dans
// routes/auth.js sera accessible sous /api/auth/...
// ⚠️ Cette ligne doit venir APRÈS express.json(), sinon req.body sera vide.
// 🔧 DÉBOGAGE : "Cannot POST /api/auth/inscription" = cette ligne manque ou est mal écrite.
app.use('/api/auth', require('./routes/auth'));

// Branche les routes des boutiques : accessibles sous /api/boutiques/...
app.use('/api/boutiques', require('./routes/boutiques'));

// Branche les routes des produits : accessibles sous /api/produits/...
app.use('/api/produits', require('./routes/produits'));

// Branche la consultation publique : accessible sous /api/catalogue/...
app.use('/api/catalogue', require('./routes/catalogue'));


// ===== Bloc 6 : une première route =====
// Une route associe une ADRESSE à une RÉPONSE.
// app.get = "quand quelqu'un demande cette adresse en lecture (GET)".
// req = la requête reçue, res = la réponse qu'on renvoie.
app.get('/api/sante', (req, res) => {
  // res.json envoie une réponse au format JSON (le langage d'échange des API)
  res.json({ message: 'Le serveur fonctionne !' });
});



/* ===== Gestion des erreurs ===== */

// Toute adresse /api/... qui n'existe pas répond en JSON, pas en page HTML
app.use('/api', (req, res) => {
  res.status(404).json({ erreurs: ['Route introuvable.'] });
});

/*
  Gestionnaire d'erreurs global : Express l'appelle quand une erreur
  n'a été attrapée nulle part.
  ⚠️ Il DOIT avoir exactement 4 paramètres, sinon Express ne le reconnaît pas.
  Il doit aussi venir EN DERNIER, après toutes les routes.
*/
app.use((erreur, req, res, next) => {
  // Si la réponse est déjà partie, on laisse Express terminer
  if (res.headersSent) {
    return next(erreur);
  }

  // JSON mal écrit dans la requête (virgule oubliée, accolade manquante...)
  if (erreur.type === 'entity.parse.failed') {
    return res.status(400).json({ erreurs: ['JSON invalide.'] });
  }

  // JSON plus gros que la limite de 10 Ko
  if (erreur.type === 'entity.too.large') {
    return res.status(413).json({ erreurs: ['Requête trop volumineuse.'] });
  }

  /*
    Toute autre erreur : on la note dans le terminal (pour toi),
    mais on ne montre AUCUN détail à l'utilisateur.
  */
  console.error('Erreur non prévue :', erreur);
  return res.status(500).json({ erreurs: ['Erreur interne du serveur.'] });
});


// ===== Bloc 7 : démarrer le serveur =====
// listen = "commence à écouter les requêtes sur ce port".
// La fonction fléchée s'exécute une fois le serveur démarré.
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});





