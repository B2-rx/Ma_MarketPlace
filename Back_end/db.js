// ===== Bloc 1 : importer les outils =====
// better-sqlite3 : la bibliothèque qui parle à SQLite.
// path : outil intégré à Node pour fabriquer des chemins de fichiers sans erreur.
const Database = require('better-sqlite3');
const path = require('path');


// ===== Bloc 2 : ouvrir (ou créer) la base =====
// __dirname = le dossier du fichier actuel (Back_end).
// Si marketplace.db n'existe pas, SQLite le crée automatiquement.
// 🔧 À MODIFIER : change le nom du fichier si tu veux, mais garde l'extension .db
// (c'est elle que ton .gitignore protège).
const db = new Database(path.join(__dirname, 'marketplace.db'));



// ===== Bloc 3 : activer les clés étrangères =====
// SQLite ne vérifie PAS les liens entre tables par défaut.
// Cette ligne l'active : on évitera par exemple une commande liée à un client inexistant.
db.pragma('foreign_keys = ON');



// ===== Bloc 4 : creation des tables  =====
// table utilisateurs
// "IF NOT EXISTS" : si la table existe déjà, on ne la recrée pas.
// Ce code peut donc s'exécuter à chaque démarrage sans rien casser.
db.exec(`
  CREATE TABLE IF NOT EXISTS utilisateurs (
    -- Numéro unique, attribué automatiquement (1, 2, 3...)
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- UNIQUE : impossible d'avoir deux comptes avec le même email
    email TEXT NOT NULL UNIQUE,

    -- Le téléphone est stocké en texte (un numéro n'est pas un nombre
    -- sur lequel on calcule, et il peut commencer par 0 ou +)
    telephone TEXT NOT NULL,

    -- On ne stocke JAMAIS le mot de passe lui-même, seulement son "hash"
    -- (une empreinte illisible, qu'on générera à l'étape d'inscription)
    mot_de_passe_hash TEXT NOT NULL,

    -- CHECK : seules ces deux valeurs sont acceptées par la base
    role TEXT NOT NULL CHECK (role IN ('client', 'commercant')),

    -- Remplie automatiquement avec la date et l'heure de création
    date_creation TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ===== Bloc 4bis : créer la table "boutiques" =====
db.exec(`
  CREATE TABLE IF NOT EXISTS boutiques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Le commerçant propriétaire. UNIQUE = une seule boutique par commerçant.
    -- REFERENCES = lien vers utilisateurs(id) : impossible d'utiliser un id inexistant
    -- (grâce aux clés étrangères activées plus haut).
    -- ON DELETE CASCADE = si le compte est supprimé, sa boutique l'est aussi.
    utilisateur_id INTEGER NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,

    nom TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    secteur TEXT NOT NULL,

    -- On stocke uniquement le CHEMIN de l'image (ex. "uploads/boutique-1.jpg"),
    -- jamais l'image elle-même. NULL = pas encore d'image.
    image_chemin TEXT,

    date_creation TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
console.log('Base de données prête : tables "utilisateurs" et "boutiques" OK');

// ===== Bloc 4ter : créer la table "produits" =====
db.exec(`
  CREATE TABLE IF NOT EXISTS produits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- La boutique propriétaire. Si la boutique est supprimée, ses produits aussi.
    boutique_id INTEGER NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,

    nom TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',

    -- Prix en nombre ENTIER : 1.50 est stocké 150 (voir DECIMALES dans routes/produits.js).
    -- CHECK : la base refuse un prix négatif, même si le code se trompait.
    prix_entier INTEGER NOT NULL CHECK (prix_entier >= 0),

    -- 1 = visible et commandable, 0 = masqué (rupture de stock).
    -- SQLite n'a pas de vrai type booléen : on utilise 0 et 1.
    disponible INTEGER NOT NULL DEFAULT 1 CHECK (disponible IN (0, 1)),

    date_creation TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Index : accélère la recherche "tous les produits d'une boutique",
  -- qui sera la requête la plus fréquente.
  CREATE INDEX IF NOT EXISTS idx_produits_boutique ON produits(boutique_id);
`);
console.log('Base de données prête : tables "utilisateurs", "boutiques" et "produits" OK');


// ===== Bloc 6 : partager la connexion =====
// Les autres fichiers feront : const db = require('./db');
module.exports = db;