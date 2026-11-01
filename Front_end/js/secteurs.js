/* ===== constantes.js : listes partagées par les pages ===== */

/*
  Secteurs d'établissement : le code (envoyé au serveur) et son libellé (affiché).
  ⚠️ Les codes doivent rester identiques à SECTEURS dans Back_end/constantes.js.
  🔧 À MODIFIER : pour ajouter un secteur, ajoute-le ici ET dans le backend.
*/
export const SECTEURS = [
  { code: 'restauration', libelle: 'Restauration' },
  { code: 'boulangerie', libelle: 'Boulangerie' },
  { code: 'epicerie', libelle: 'Épicerie' },
  { code: 'boissons', libelle: 'Boissons' },
  { code: 'autre', libelle: 'Autre' }
];

// Libellé affiché pour un code (le code lui-même si on ne le connaît pas)
export function libelleSecteur(code) {
  const secteur = SECTEURS.find((element) => element.code === code);

  return secteur ? secteur.libelle : code;
}




