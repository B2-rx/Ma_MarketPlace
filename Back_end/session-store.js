/* ===== Bloc 1 : importer les outils ===== */
const session = require('express-session');
const crypto = require('crypto');


/* ===== Bloc 2 : réglages ===== */

/*
  Durée de vie d'une session si le cookie n'en précise pas (7 jours, en ms).
  🔧 À MODIFIER : garde la même durée que "maxAge" dans server.js.
*/
const DUREE_DEFAUT = 1000 * 60 * 60 * 24 * 7;

// Intervalle du nettoyage automatique des sessions expirées (1 heure, en ms)
const INTERVALLE_NETTOYAGE = 1000 * 60 * 60;


/* ===== Bloc 3 : outils ===== */

/*
  On ne range pas l'identifiant de session tel quel dans la base, mais son
  empreinte (SHA-256, à sens unique). Si quelqu'un lisait la base ou une
  sauvegarde, il ne pourrait pas reconstituer les cookies des utilisateurs
  connectés.
*/
function empreinte(sid) {
  return crypto.createHash('sha256').update(sid).digest('hex');
}

// Calcule la date d'expiration (en millisecondes) à partir du cookie de la session
function calculerExpiration(donneesSession) {
  const expires = donneesSession.cookie && donneesSession.cookie.expires;

  return expires ? new Date(expires).getTime() : Date.now() + DUREE_DEFAUT;
}


/* ===== Bloc 4 : le stockage ===== */

/*
  "extends session.Store" : notre classe respecte le contrat d'express-session.
  Express appelle ces méthodes tout seul :
    get     = retrouver une session (à chaque requête)
    set     = enregistrer une session (connexion, modification)
    destroy = supprimer une session (déconnexion)
    touch   = prolonger une session sans la modifier
  Chacune reçoit un "callback" : une fonction à appeler une fois le travail
  terminé, avec l'erreur (ou null) en premier argument.
*/
class StockageSqlite extends session.Store {
  constructor(db) {
    super();

    // Crée la table des sessions si elle n'existe pas encore
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        -- Empreinte de l'identifiant de session (jamais l'identifiant lui-même)
        empreinte TEXT PRIMARY KEY,

        -- Contenu de la session au format JSON (id et rôle de l'utilisateur)
        donnees TEXT NOT NULL,

        -- Date d'expiration, en millisecondes
        expire INTEGER NOT NULL
      );

      -- Accélère le nettoyage des sessions expirées
      CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
    `);

    // Requêtes préparées (les "?" sont remplacés par les vraies valeurs)
    this.lire = db.prepare(`
      SELECT donnees FROM sessions WHERE empreinte = ? AND expire > ?
    `);

    // Upsert : crée la session, ou la met à jour si elle existe déjà
    this.ecrire = db.prepare(`
      INSERT INTO sessions (empreinte, donnees, expire) VALUES (?, ?, ?)
      ON CONFLICT(empreinte) DO UPDATE SET
        donnees = excluded.donnees,
        expire = excluded.expire
    `);

    this.supprimer = db.prepare(`DELETE FROM sessions WHERE empreinte = ?`);
    this.prolonger = db.prepare(`UPDATE sessions SET expire = ? WHERE empreinte = ?`);
    this.nettoyer = db.prepare(`DELETE FROM sessions WHERE expire <= ?`);

    // Nettoyage au démarrage, puis une fois par heure
    this.nettoyer.run(Date.now());

    this.minuteur = setInterval(() => {
      this.nettoyer.run(Date.now());
    }, INTERVALLE_NETTOYAGE);

    // unref : ce minuteur n'empêche pas le serveur de s'arrêter proprement
    this.minuteur.unref();
  }

      // Retrouve une session. Renvoie null si elle n'existe pas ou a expiré.
  get(sid, callback) {
    try {
      const ligne = this.lire.get(empreinte(sid), Date.now());

      callback(null, ligne ? JSON.parse(ligne.donnees) : null);
    } catch (erreur) {
      callback(erreur);
    }
  }

  // Enregistre (ou met à jour) une session
  set(sid, donneesSession, callback) {
    try {
      this.ecrire.run(
        empreinte(sid),
        JSON.stringify(donneesSession),
        calculerExpiration(donneesSession)
      );

      callback(null);
    } catch (erreur) {
      callback(erreur);
    }
  }

  // Supprime une session (déconnexion)
  destroy(sid, callback) {
    try {
      this.supprimer.run(empreinte(sid));

      callback(null);
    } catch (erreur) {
      callback(erreur);
    }
  }

  // Prolonge la durée de vie d'une session sans toucher à son contenu
  touch(sid, donneesSession, callback) {
    try {
      this.prolonger.run(calculerExpiration(donneesSession), empreinte(sid));

      callback(null);
    } catch (erreur) {
      callback(erreur);
    }
  }
}


/* ===== Bloc 5 : partager la classe ===== */
module.exports = StockageSqlite;