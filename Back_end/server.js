// ===== Bloc 1 : importer Express =====
// "require" charge une bibliothèque installée avec npm.
// "express" est ici une fonction qui crée notre application serveur.
const express = require('express');

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