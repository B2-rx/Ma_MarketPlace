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

// ===== Bloc 2 : créer l'application =====
// "app" représente notre serveur. Toutes les routes y seront ajoutées.
const app = express();

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
app.use(express.json());

// ===== Sessions =====
// Sécurité : sans clé secrète, on refuse de démarrer plutôt que d'être mal protégé.
// 🔧 DÉBOGAGE : cette erreur = le fichier .env manque ou n'est pas dans Back_end.
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET manquant : vérifie ton fichier .env');
}

app.use(session({
  // Clé qui signe le cookie (lue dans .env, jamais écrite dans le code)
  secret: process.env.SESSION_SECRET,

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


// Branche les routes d'authentification : tout ce qui est défini dans
// routes/auth.js sera accessible sous /api/auth/...
// ⚠️ Cette ligne doit venir APRÈS express.json(), sinon req.body sera vide.
// 🔧 DÉBOGAGE : "Cannot POST /api/auth/inscription" = cette ligne manque ou est mal écrite.
app.use('/api/auth', require('./routes/auth'));




// Branche les routes des boutiques : accessibles sous /api/boutiques/...
app.use('/api/boutiques', require('./routes/boutiques'));





// ===== Bloc 5 : une première route =====
// Une route associe une ADRESSE à une RÉPONSE.
// app.get = "quand quelqu'un demande cette adresse en lecture (GET)".
// req = la requête reçue, res = la réponse qu'on renvoie.
app.get('/api/sante', (req, res) => {
  // res.json envoie une réponse au format JSON (le langage d'échange des API)
  res.json({ message: 'Le serveur fonctionne !' });
});

// ===== Bloc 6 : démarrer le serveur =====
// listen = "commence à écouter les requêtes sur ce port".
// La fonction fléchée s'exécute une fois le serveur démarré.
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});





