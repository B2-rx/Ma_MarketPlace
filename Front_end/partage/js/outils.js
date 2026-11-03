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



/* ===== Redirection après connexion ===== */

/*
  Lit le paramètre "retour" de l'adresse (?retour=/panier/panier.html) : la page
  que l'utilisateur voulait voir avant d'être renvoyé vers la connexion.

  ⚠️ SÉCURITÉ : ce paramètre est modifiable par n'importe qui. Un lien piégé
  pourrait contenir ?retour=//site-pirate.com. On n'accepte donc qu'un CHEMIN
  de notre site, commençant par UN SEUL "/" (jamais "//", "/\" ni "https://").
  Renvoie null si le paramètre est absent ou suspect.
*/
export function lireRetour() {
  const retour = new URLSearchParams(window.location.search).get('retour');

  if (retour === null || !/^\/(?![\/\\])[\w\-./]*$/.test(retour)) {
    return null;
  }

  return retour;
}



/* ===== Images ===== */

/*
  Forme exacte d'un chemin d'image fabriqué par le serveur :
  "uploads/" + 32 caractères hexadécimaux + extension.
*/
const MODELE_IMAGE = /^uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;

/*
  Transforme le chemin reçu du serveur en adresse utilisable, ou renvoie null.
  Un chemin qui n'a pas cette forme exacte est refusé : même si la base
  contenait un jour une valeur piégée, elle ne servirait jamais d'adresse d'image.
*/
export function urlImage(chemin) {
  if (typeof chemin !== 'string' || !MODELE_IMAGE.test(chemin)) {
    return null;
  }

  return '/' + chemin;
}

/*
  Crée l'image d'une boutique, ou un bloc « Pas d'image » si elle n'en a pas.
    classe : "vignette" donne "vignette" (image) ou "vignette-vide" (sans image)
  alt est vide : le nom de la boutique est toujours écrit à côté, la lire
  deux fois serait inutile pour un lecteur d'écran.
*/
export function creerImage(chemin, description, classe) {
  const adresse = urlImage(chemin);

  if (adresse === null) {
    return creerElement('div', "Pas d'image", classe + '-vide');
  }

  const image = document.createElement('img');

  image.src = adresse;
  image.alt = description;
  image.loading = 'lazy';
  image.className = classe;

  return image;
}



/* ===== Confirmation ===== */

/*
  Ouvre une boîte de dialogue (<dialog>) et attend le choix de l'utilisateur.
  Renvoie true s'il clique sur le bouton dont la valeur est "oui", false pour
  tout le reste (bouton « non », touche Échap).
  Les boutons de la boîte sont dans un <form method="dialog"> : leur valeur
  devient dialogue.returnValue à la fermeture, sans aucun JavaScript.
*/
export function demanderConfirmation(dialogue) {
  return new Promise((resolve) => {
    // La valeur de la fermeture précédente ne doit pas compter
    dialogue.returnValue = '';

    dialogue.addEventListener(
      'close',
      () => resolve(dialogue.returnValue === 'oui'),
      { once: true }
    );

    // showModal : fond bloqué, focus gardé dans la boîte, Échap pour fermer
    dialogue.showModal();
  });
}




