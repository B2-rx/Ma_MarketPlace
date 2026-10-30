/* ===== outils.js : petites fonctions partagées par toutes les pages ===== */


/* ===== Prix et dates ===== */

/*
  Nombre de décimales de la monnaie.
  ⚠️ Doit rester identique à DECIMALES dans Back_end/constantes.js :
  le serveur envoie 300, la page affiche "300 FCFA".
*/
const DECIMALES = 0;

const formatNombre = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: DECIMALES,
  maximumFractionDigits: DECIMALES
});

// 1250 devient "1 250 FCFA" (espace insécable : le montant ne se coupe pas en deux)
export function formaterPrix(montant) {
  return formatNombre.format(montant) + '\u00A0FCFA';
}

const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/*
  Le serveur envoie "2026-10-24 12:30:00" en heure UTC (sans fuseau).
  On le convertit en vraie date UTC, puis le navigateur l'affiche à l'heure locale.
*/
export function formaterDate(texteSqlite) {
  const date = new Date(String(texteSqlite).replace(' ', 'T') + 'Z');

  return Number.isNaN(date.getTime()) ? '' : formatDate.format(date);
}


/* ===== Construire l'affichage sans risque ===== */

/*
  Crée un élément avec un texte. textContent traite TOUJOURS le texte comme du
  texte : un nom de boutique contenant "<script>" s'affichera tel quel et ne
  s'exécutera jamais.
  ⚠️ Règle du projet : jamais de innerHTML avec une donnée venue du serveur.
*/
export function creerElement(balise, texte, classe) {
  const element = document.createElement(balise);

  element.textContent = texte;

  if (classe) {
    element.className = classe;
  }

  return element;
}

/*
  Affiche une liste de messages dans une zone.
    type : 'erreur', 'ok' ou 'info'
  Une zone vide (aucun message) est cachée.
*/
export function afficherMessages(zone, type, messages) {
  zone.replaceChildren();
  zone.className = 'message message-' + type;
  zone.setAttribute('role', type === 'erreur' ? 'alert' : 'status');

  messages.forEach((message) => {
    zone.append(creerElement('p', message));
  });

  zone.hidden = messages.length === 0;
}


/* ===== Éviter le double clic ===== */

/*
  Exécute "travail" (une fonction asynchrone) en désactivant le bouton
  pendant ce temps. Un double clic n'envoie donc qu'une seule requête.
*/
export async function pendant(bouton, travail) {
  if (bouton.disabled) {
    return;
  }

  bouton.disabled = true;

  try {
    await travail();
  } finally {
    bouton.disabled = false;
  }
}