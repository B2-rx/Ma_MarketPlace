/* ===== api.js : tout le dialogue avec le serveur passe par ici ===== */

/*
  Appelle une route de l'API et renvoie TOUJOURS le même format :
    { ok, statut, donnees, erreurs }

    ok       : true si le code HTTP est 2xx
    statut   : le code HTTP (0 si le serveur est injoignable)
    donnees  : le JSON reçu ({} si la réponse n'est pas du JSON)
    erreurs  : tableau de messages lisibles ([] si tout va bien)

  Les pages n'ont donc jamais à gérer une exception ni une réponse inattendue.

  Paramètres :
    methode  : 'GET', 'POST', 'PUT', 'PATCH' ou 'DELETE'
    adresse  : par exemple '/api/panier'
    corps    : un objet (envoyé en JSON) ou un FormData (envoi de fichier)
    options  : { sansRedirection: true } pour gérer soi-même le 401
*/
export async function appeler(methode, adresse, corps, options) {
  const reglages = options || {};

  const requete = {
    method: methode,

    // Le cookie de session part avec la requête (même adresse que le site)
    credentials: 'same-origin',

    // Jamais de réponse gardée en cache : un statut de commande doit être à jour
    cache: 'no-store',

    headers: { Accept: 'application/json' }
  };

  if (corps instanceof FormData) {
    // Envoi de fichier : le navigateur fabrique lui-même l'en-tête Content-Type
    requete.body = corps;
  } else if (corps !== undefined) {
    requete.headers['Content-Type'] = 'application/json';
    requete.body = JSON.stringify(corps);
  }

  let reponse;

  try {
    reponse = await fetch(adresse, requete);
  } catch (erreur) {
    // Serveur arrêté, coupure réseau... : on ne montre pas le détail technique
    return {
      ok: false,
      statut: 0,
      donnees: {},
      erreurs: ['Impossible de joindre le serveur. Vérifie ta connexion.']
    };
  }

  // Une réponse qui n'est pas du JSON (page d'erreur, par exemple) donne {}
  let donnees = {};

  try {
    donnees = await reponse.json();
  } catch (erreur) {
    donnees = {};
  }

  /*
    401 = session absente ou expirée : on renvoie vers la connexion, en gardant
    la page d'origine dans "retour" pour y revenir ensuite.
    ⚠️ La page de connexion devra vérifier que "retour" commence par un seul "/"
    avant de l'utiliser (sinon, redirection vers un site pirate).
  */
  if (reponse.status === 401 && !reglages.sansRedirection) {
    window.location.href = '/connexion/connexion.html?retour=' + encodeURIComponent(window.location.pathname);
  }

  return {
    ok: reponse.ok,
    statut: reponse.status,
    donnees,
    erreurs: reponse.ok ? [] : lireErreurs(reponse.status, donnees)
  };
}

/*
  Extrait les messages d'erreur. Le serveur envoie { erreurs: ["...", "..."] } :
  on ne les garde que s'ils sont bien des textes. Sinon, un message générique.
  Ces textes seront affichés avec textContent : jamais interprétés comme du HTML.
*/
function lireErreurs(statut, donnees) {
  const liste = donnees.erreurs;

  if (Array.isArray(liste) && liste.length > 0 && liste.every((e) => typeof e === 'string')) {
    return liste;
  }

  if (statut === 429) {
    return ['Trop de requêtes. Réessaie dans quelques minutes.'];
  }

  if (statut >= 500) {
    return ['Erreur du serveur. Réessaie plus tard.'];
  }

  return ['Une erreur est survenue.'];
}