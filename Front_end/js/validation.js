/* ===== validation.js : contrôles faits dans le navigateur ===== */

/*
  ⚠️ Ces règles COPIENT celles du serveur (Back_end/routes/auth.js).
  Elles servent à prévenir l'utilisateur sans attendre une réponse, rien de plus :
  le serveur revérifie tout et reste le seul juge. Si une règle change côté
  serveur, change-la aussi ici.
*/
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEPHONE = /^\+?[0-9 .-]{8,20}$/;

// Vérifications de la page de connexion : on reste minimal
export function validerConnexion(email, motDePasse) {
  const erreurs = [];

  if (email.length > 254 || !REGEX_EMAIL.test(email)) {
    erreurs.push('Email invalide.');
  }

  if (motDePasse.length === 0) {
    erreurs.push('Mot de passe requis.');
  }

  return erreurs;
}

// Vérifications de la page d'inscription : mêmes règles que le serveur
export function validerInscription({ email, telephone, motDePasse, role }) {
  const erreurs = [];

  if (email.length > 254 || !REGEX_EMAIL.test(email)) {
    erreurs.push('Email invalide.');
  }

  if (!REGEX_TELEPHONE.test(telephone)) {
    erreurs.push('Téléphone invalide (8 à 20 chiffres, "+" autorisé au début).');
  }

  if (
    motDePasse.length < 8
    || motDePasse.length > 72
    || !/[A-Za-z]/.test(motDePasse)
    || !/[0-9]/.test(motDePasse)
  ) {
    erreurs.push('Mot de passe invalide (8 à 72 caractères, avec au moins une lettre et un chiffre).');
  }

  if (role !== 'client' && role !== 'commercant') {
    erreurs.push('Choisis un type de compte.');
  }

  return erreurs;
}