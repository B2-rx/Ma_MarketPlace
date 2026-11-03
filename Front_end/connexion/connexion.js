/* ===== connexion.js : la page de connexion ===== */
import { appeler } from '/partage/js/api.js';
import { afficherMessages, pendant } from '/partage/js/outils.js';
import { lireUtilisateur, redirigerApresConnexion } from '/partage/js/session.js';
import { validerConnexion } from '/partage/js/validation.js';

const formulaire = document.getElementById('formulaire');
const zone = document.getElementById('messages');
const champEmail = document.getElementById('email');
const champMotDePasse = document.getElementById('mot-de-passe');
const caseAfficher = document.getElementById('afficher');
const boutonValider = document.getElementById('valider');

// Affiche les erreurs et place le focus dessus (lu par les lecteurs d'écran)
function montrerErreurs(messages) {
  afficherMessages(zone, 'erreur', messages);
  zone.focus();
}

// Déjà connecté : inutile de rester sur cette page
const dejaConnecte = await lireUtilisateur();

if (dejaConnecte) {
  redirigerApresConnexion(dejaConnecte.role);
}

// Affiche ou cache le mot de passe saisi
caseAfficher.addEventListener('change', () => {
  champMotDePasse.type = caseAfficher.checked ? 'text' : 'password';
});

formulaire.addEventListener('submit', (evenement) => {
  // Empêche le navigateur de recharger la page : c'est notre code qui envoie
  evenement.preventDefault();

  const email = champEmail.value.trim();
  const motDePasse = champMotDePasse.value;

  const erreurs = validerConnexion(email, motDePasse);

  if (erreurs.length > 0) {
    montrerErreurs(erreurs);
    return;
  }

  pendant(boutonValider, async () => {
    const reponse = await appeler(
      'POST',
      '/api/auth/connexion',
      { email, motDePasse },
      { sansRedirection: true }
    );

    if (reponse.ok) {
      redirigerApresConnexion(reponse.donnees.utilisateur.role);
      return;
    }

    /*
      401 (identifiants faux), 429 (trop d'essais), 400 ou panne : le message
      vient du serveur. Le mot de passe saisi est effacé dans tous les cas.
    */
    champMotDePasse.value = '';
    montrerErreurs(reponse.erreurs);
  });
});


