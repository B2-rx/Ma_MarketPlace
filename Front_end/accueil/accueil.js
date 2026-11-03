/* ===== accueil.js : le comportement de la page d'accueil ===== */

/*
  "import" charge des fonctions d'un autre fichier. Les fichiers JavaScript du
  frontend sont des MODULES : chacun a ses propres variables, sans risque de
  collision avec les autres.
*/
import { appeler } from '/partage/js/api.js';
import { afficherMessages, pendant } from '/partage/js/outils.js';

const zone = document.getElementById('resultat');
const boutonSante = document.getElementById('btn-sante');
const boutonMoi = document.getElementById('btn-moi');

// Test 1 : le serveur répond-il ?
boutonSante.addEventListener('click', () => {
  pendant(boutonSante, async () => {
    const reponse = await appeler('GET', '/api/sante');

    if (reponse.ok) {
      afficherMessages(zone, 'ok', [reponse.donnees.message]);
    } else {
      afficherMessages(zone, 'erreur', reponse.erreurs);
    }
  });
});

/*
  Test 2 : suis-je connecté ?
  "sansRedirection" : un 401 est ici une réponse NORMALE (visiteur non connecté),
  pas une session expirée : on ne renvoie pas vers la connexion.
*/
boutonMoi.addEventListener('click', () => {
  pendant(boutonMoi, async () => {
    const reponse = await appeler('GET', '/api/auth/moi', undefined, { sansRedirection: true });

    if (reponse.ok) {
      const { email, role } = reponse.donnees.utilisateur;

      afficherMessages(zone, 'ok', [`Connecté : ${email} (${role})`]);
    } else if (reponse.statut === 401) {
      afficherMessages(zone, 'info', ["Tu n'es pas connecté."]);
    } else {
      afficherMessages(zone, 'erreur', reponse.erreurs);
    }
  });
});