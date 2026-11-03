/* ===== inscription.js : la page d'inscription ===== */
import { appeler } from '/partage/js/api.js';
import { afficherMessages, pendant } from '/partage/js/outils.js';
import { lireUtilisateur, redirigerApresConnexion } from '/partage/js/session.js';
import { validerInscription } from '/partage/js/validation.js';

const formulaire = document.getElementById('formulaire');
const zone = document.getElementById('messages');
const champEmail = document.getElementById('email');
const champTelephone = document.getElementById('telephone');
const champMotDePasse = document.getElementById('mot-de-passe');
const caseAfficher = document.getElementById('afficher');
const boutonValider = document.getElementById('valider');

function montrerErreurs(messages) {
  afficherMessages(zone, 'erreur', messages);
  zone.focus();
}

// Déjà connecté : inutile de créer un compte
const dejaConnecte = await lireUtilisateur();

if (dejaConnecte) {
  redirigerApresConnexion(dejaConnecte.role);
}

caseAfficher.addEventListener('change', () => {
  champMotDePasse.type = caseAfficher.checked ? 'text' : 'password';
});


/*
  Changer de type de compte (Client / Commerçant) repart d'un formulaire vide.
  On n'utilise pas formulaire.reset() : il remettrait aussi le choix du rôle
  sur sa valeur de départ.
*/
const boutonsRole = formulaire.querySelectorAll('input[name="role"]');

boutonsRole.forEach((bouton) => {
  bouton.addEventListener('change', () => {
    champEmail.value = '';
    champTelephone.value = '';
    champMotDePasse.value = '';

    // Le mot de passe redevient masqué
    caseAfficher.checked = false;
    champMotDePasse.type = 'password';

    // Efface aussi un éventuel message d'erreur affiché
    zone.replaceChildren();
    zone.hidden = true;
  });
});



formulaire.addEventListener('submit', (evenement) => {
  evenement.preventDefault();

  const donnees = {
    email: champEmail.value.trim(),
    telephone: champTelephone.value.trim(),
    motDePasse: champMotDePasse.value,

    // Valeur du bouton radio coché ("" si aucun)
    role: formulaire.elements.role.value
  };

  const erreurs = validerInscription(donnees);

  if (erreurs.length > 0) {
    montrerErreurs(erreurs);
    return;
  }

  pendant(boutonValider, async () => {
    const inscription = await appeler(
      'POST',
      '/api/auth/inscription',
      donnees,
      { sansRedirection: true }
    );

    // 400 (donnée refusée), 409 (email déjà pris), 429 (trop de comptes), panne
    if (!inscription.ok) {
      montrerErreurs(inscription.erreurs);
      return;
    }

    /*
      Le compte existe : on connecte directement l'utilisateur.
      Si cette connexion échoue (cas rare), on l'envoie vers la page de connexion.
    */
    const connexion = await appeler(
      'POST',
      '/api/auth/connexion',
      { email: donnees.email, motDePasse: donnees.motDePasse },
      { sansRedirection: true }
    );

    if (connexion.ok) {
      redirigerApresConnexion(connexion.donnees.utilisateur.role);
    } else {
      window.location.href = '/connexion/connexion.html';
    }
  });
});





