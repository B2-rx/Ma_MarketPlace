/* ===== session.js : qui est connecté ? ===== */
import { appeler } from './api.js';
import { lireRetour } from './outils.js';

/*
  Page d'arrivée après la connexion, selon le rôle.
  🔧 À MODIFIER au fil des étapes : "client" pointera vers la liste des
  établissements (étape 28), "commercant" vers son tableau de bord (étape 31).
*/
const PAGES_ACCUEIL = {
  client: '/liste-etablissements.html',
  commercant: '/'
};



/*
  Lit l'utilisateur connecté, ou null pour un visiteur.
  La réponse est gardée en mémoire pour la durée de la page : le menu et la
  page elle-même appellent cette fonction, mais le serveur n'est interrogé
  qu'UNE seule fois.
*/
let promesse = null;

export function lireUtilisateur() {
  if (promesse === null) {
    /*
      sansRedirection : un 401 est ici une réponse NORMALE (visiteur non connecté),
      pas une session expirée.
    */
    promesse = appeler('GET', '/api/auth/moi', undefined, { sansRedirection: true })
      .then((reponse) => (reponse.ok ? reponse.donnees.utilisateur : null));
  }

  return promesse;
}

// Envoie l'utilisateur vers la page qu'il visait, sinon vers sa page d'accueil
export function redirigerApresConnexion(role) {
  window.location.replace(lireRetour() || PAGES_ACCUEIL[role] || '/');
}

// Détruit la session côté serveur, puis renvoie vers la connexion
export async function deconnecter() {
  await appeler('POST', '/api/auth/deconnexion', undefined, { sansRedirection: true });

  window.location.href = '/connexion.html';
}



