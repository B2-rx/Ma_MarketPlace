/* ============================================================
   ma-boutique.js : page « Ma boutique » du commerçant
   Rôle : charger la boutique, l'enregistrer, envoyer son image.
   Le serveur reste le seul juge : les contrôles ci-dessous ne
   servent qu'à éviter un aller-retour inutile.
   ============================================================ */

/* ---- 1. IMPORTS : outils partagés (Front_end/partage/js) ---- */
import { appeler } from '/partage/js/api.js';
import { lireUtilisateur } from '/partage/js/session.js';
import { afficherMessages, pendant, urlImage } from '/partage/js/outils.js';
import { SECTEURS } from '/partage/js/secteurs.js';

/* ---- 2. RÉGLAGES À VÉRIFIER (voir étape 0) ----
   Les limites doivent rester identiques à Back_end/routes/boutiques.js.
   Si l'upload échoue avec une erreur 400 alors que le fichier est bon,
   vérifie d'abord CHAMP_IMAGE dans tests-api/upload.http. */
const CHAMP_IMAGE = 'image';
const NOM_MIN = 2;
const NOM_MAX = 60;
const DESCRIPTION_MAX = 500;
const TAILLE_IMAGE_MAX = 2 * 1024 * 1024; /* 2 Mo, comme multer côté serveur */
const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];

/* ---- 3. ÉLÉMENTS DE LA PAGE ---- */
const zoneMessages = document.getElementById('messages');
const formulaireBoutique = document.getElementById('formulaire-boutique');
const champNom = document.getElementById('champ-nom');
const champSecteur = document.getElementById('champ-secteur');
const champDescription = document.getElementById('champ-description');
const compteur = document.getElementById('compteur');
const formulaireImage = document.getElementById('formulaire-image');
const champFichier = document.getElementById('champ-fichier');
const apercu = document.getElementById('apercu-image');
const sansImage = document.getElementById('sans-image');

/* ---- 4. LECTURE DE LA RÉPONSE DU SERVEUR ----
   Seul endroit qui connaît les noms des champs JSON.
   À MODIFIER ici si ta réponse GET /api/boutiques/ma-boutique
   utilise d'autres noms (voir tests-api/boutiques.http). */
function lireBoutique(donnees) {
  const b = donnees?.boutique ?? donnees;
  return {
    nom: b?.nom ?? '',
    description: b?.description ?? '',
    secteur: b?.secteur ?? '',
    imageChemin: b?.imageChemin ?? b?.image_chemin ?? null,
  };
}

/* ---- 5. AFFICHAGE ---- */
function remplirSecteurs() {
  const vide = document.createElement('option');
  vide.value = '';
  vide.textContent = 'Choisir un secteur';
  champSecteur.append(vide);

 
  for (const s of SECTEURS) {
    /* Chaque secteur est { code, libelle } (voir partage/js/secteurs.js) :
       le code part au serveur, le libellé s'affiche. */
    const option = document.createElement('option');
    option.value = s.code;
    option.textContent = s.libelle;
    champSecteur.append(option);
  }
}

function majCompteur() {
  compteur.textContent = String(champDescription.value.length);
}

/* Pas d'aperçu local avant l'envoi : la CSP stricte interdit les
   images « blob: ». On affiche l'image après l'envoi, depuis le serveur. */
function afficherImage(chemin) {
  const adresse = chemin ? urlImage(chemin) : null;
  if (adresse) {
    apercu.src = adresse;
    apercu.hidden = false;
    sansImage.hidden = true;
  } else {
    apercu.hidden = true;
    sansImage.hidden = false;
  }
}

/* ---- 6. CHARGEMENT ---- */
async function chargerBoutique() {
  const r = await appeler('GET', '/api/boutiques/ma-boutique');
  if (r.statut === 404) return; /* pas encore de boutique : formulaire vide */
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  const b = lireBoutique(r.donnees);
  champNom.value = b.nom;
  champSecteur.value = b.secteur;
  champDescription.value = b.description;
  majCompteur();
  afficherImage(b.imageChemin);
}

/* ---- 7. ENREGISTRER LES INFORMATIONS ---- */
function verifierBoutique(corps) {
  const erreurs = [];
  if (corps.nom.length < NOM_MIN || corps.nom.length > NOM_MAX) {
    erreurs.push(`Le nom doit contenir de ${NOM_MIN} à ${NOM_MAX} caractères.`);
  }
  if (!corps.secteur) erreurs.push('Choisissez un secteur.');
  if (corps.description.length > DESCRIPTION_MAX) {
    erreurs.push(`La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`);
  }
  return erreurs;
}

formulaireBoutique.addEventListener('submit', async (evenement) => {
  evenement.preventDefault(); /* empêche le rechargement de la page */

  const corps = {
    nom: champNom.value.trim(),
    description: champDescription.value.trim(),
    secteur: champSecteur.value,
  };
  const erreurs = verifierBoutique(corps);
  if (erreurs.length > 0) {
    afficherMessages(zoneMessages, erreurs, 'erreur');
    return;
  }

  const bouton = formulaireBoutique.querySelector('button[type="submit"]');
  await pendant(bouton, async () => {
    const r = await appeler('PUT', '/api/boutiques/ma-boutique', corps);
    if (r.ok) afficherMessages(zoneMessages, ['Boutique enregistrée.'], 'succes');
    else afficherMessages(zoneMessages, r.erreurs, 'erreur');
  });
});

/* ---- 8. ENVOYER L'IMAGE ----
   Un fichier part en « multipart/form-data » (FormData), pas en JSON.
   On utilise fetch directement, SANS écrire l'en-tête Content-Type :
   le navigateur le fabrique lui-même avec la bonne « frontière ».
   Les cookies de session partent automatiquement (même origine). */
formulaireImage.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();

  const fichier = champFichier.files[0];
  if (!fichier) {
    afficherMessages(zoneMessages, ['Choisissez un fichier.'], 'erreur');
    return;
  }
  if (!TYPES_IMAGE.includes(fichier.type)) {
    afficherMessages(zoneMessages, ['Format accepté : JPEG, PNG ou WebP.'], 'erreur');
    return;
  }
  if (fichier.size > TAILLE_IMAGE_MAX) {
    afficherMessages(zoneMessages, ['Image trop lourde (2 Mo maximum).'], 'erreur');
    return;
  }

  const donnees = new FormData();
  donnees.append(CHAMP_IMAGE, fichier);

  const bouton = formulaireImage.querySelector('button[type="submit"]');
  await pendant(bouton, async () => {
    const reponse = await fetch('/api/boutiques/ma-boutique/image', {
      method: 'POST',
      body: donnees,
      cache: 'no-store',
    });

    if (reponse.ok) {
      champFichier.value = '';
      afficherMessages(zoneMessages, ['Image enregistrée.'], 'succes');
      await chargerBoutique(); /* recharge pour afficher la nouvelle image */
      return;
    }

    /* Messages selon le code : le serveur vérifie la vraie signature du fichier */
    let message = "L'envoi a échoué. Réessayez.";
    if (reponse.status === 401) {
      location.href = '/connexion/connexion.html?retour=' + encodeURIComponent(location.pathname);
      return;
    }
    if (reponse.status === 413) message = 'Image trop lourde (2 Mo maximum).';
    else if (reponse.status === 400) message = "Image refusée : utilisez un vrai fichier JPEG, PNG ou WebP.";
    else if (reponse.status === 404) message = "Enregistrez d'abord les informations de la boutique.";
    afficherMessages(zoneMessages, [message], 'erreur');
  });
});

/* ---- 9. DÉMARRAGE ---- */
async function demarrer() {
  const utilisateur = await lireUtilisateur();
  if (!utilisateur) {
    location.href = '/connexion/connexion.html?retour=' + encodeURIComponent(location.pathname);
    return;
  }
  if (utilisateur.role !== 'commercant') {
    location.href = '/etablissements/liste-etablissements.html';
    return;
  }
  remplirSecteurs();
  champDescription.addEventListener('input', majCompteur);
  await chargerBoutique();
}

demarrer();