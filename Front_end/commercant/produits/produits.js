/* ============================================================
   produits.js : gestion du catalogue du commerçant
   Routes utilisées : GET, POST /api/produits ; PUT, DELETE /api/produits/:id
   Tout texte venant du serveur passe par textContent (jamais innerHTML),
   donc un nom de produit « <b>x</b> » s'affiche tel quel, sans effet.
   ============================================================ */

/* ---- 1. IMPORTS ---- */
import { appeler } from '/partage/js/api.js';
import { lireUtilisateur } from '/partage/js/session.js';
import { afficherMessages, pendant, formaterPrix, demanderConfirmation } from '/partage/js/outils.js';

/* ---- 2. RÉGLAGES À VÉRIFIER (voir étape 0) ----
   Les limites doivent rester identiques à Back_end/routes/produits.js.
   CHAMP_PRIX : nom du champ du prix dans le corps JSON (tests-api/produits.http). */
const CHAMP_PRIX = 'prix';
const NOM_MIN = 2;
const NOM_MAX = 80;
const DESCRIPTION_MAX = 300;
const PRIX_MAX = 10000000;



/* ---- 3. ÉLÉMENTS DE LA PAGE ET ÉTAT ---- */
const zoneMessages = document.getElementById('messages');
const formulaire = document.getElementById('formulaire-produit');
const titreFormulaire = document.getElementById('titre-formulaire');
const champNom = document.getElementById('champ-nom');
const champPrix = document.getElementById('champ-prix');
const champDescription = document.getElementById('champ-description');
const champDisponible = document.getElementById('champ-disponible');
const boutonEnregistrer = document.getElementById('bouton-enregistrer');
const boutonAnnuler = document.getElementById('bouton-annuler');
const listeProduits = document.getElementById('liste-produits');
const listeVide = document.getElementById('liste-vide');
const dialogueSuppression = document.getElementById('dialogue-suppression');
const texteSuppression = document.getElementById('texte-suppression');

let produits = []; /* copie locale de la liste affichée */
let idEnEdition = null; /* null = mode ajout ; un nombre = mode modification */


/* ---- 4. LECTURE DES RÉPONSES ----
   À MODIFIER ici si les noms des champs JSON diffèrent. */
function lireProduit(p) {
  return {
    id: p.id,
    nom: p.nom,
    description: p.description ?? '',
    prix: p.prixEntier ?? p.prix_entier ?? p.prix,
    disponible: p.disponible === true || p.disponible === 1,
  };
}


/* ---- 5. AFFICHAGE DE LA LISTE ---- */
function creerBouton(texte, action) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton';
  bouton.textContent = texte;
  bouton.addEventListener('click', action);
  return bouton;
}


function creerLigne(produit) {
  const ligne = document.createElement('li');
  ligne.className = produit.disponible ? 'produit' : 'produit produit-indisponible';

  const infos = document.createElement('div');
  infos.className = 'produit-infos';

  const nom = document.createElement('h3');
  nom.textContent = produit.nom;

  const prix = document.createElement('p');
  prix.className = 'produit-prix';
  prix.textContent = formaterPrix(produit.prix);

  const etat = document.createElement('span');
  etat.className = 'pastille';
  etat.textContent = produit.disponible ? 'Disponible' : 'Indisponible';

  infos.append(nom, prix, etat);

  if (produit.description) {
    const description = document.createElement('p');
    description.textContent = produit.description;
    infos.append(description);
  }

  const actions = document.createElement('div');
  actions.className = 'produit-actions';
  actions.append(
    creerBouton('Modifier', () => commencerModification(produit)),
    creerBouton(produit.disponible ? 'Rendre indisponible' : 'Rendre disponible', () => basculerDisponibilite(produit)),
    creerBouton('Supprimer', () => supprimer(produit)),
  );

  ligne.append(infos, actions);
  return ligne;
}


function afficherListe() {
  listeProduits.replaceChildren(...produits.map(creerLigne));
  listeVide.hidden = produits.length > 0;
}

/* ---- 6. CHARGEMENT ---- */
async function chargerProduits() {
  const r = await appeler('GET', '/api/produits');
  if (r.statut === 404) {
    /* Pas de boutique : le serveur refuse le catalogue (chargerBoutique) */
    afficherMessages(zoneMessages, ["Créez d'abord votre boutique dans « Ma boutique »."], 'erreur');
    formulaire.hidden = true;
    return;
  }
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  const liste = Array.isArray(r.donnees) ? r.donnees : (r.donnees?.produits ?? []);
  produits = liste.map(lireProduit);
  afficherListe();
}

/* ---- 7. FORMULAIRE : mode ajout ou modification ---- */
function reinitialiserFormulaire() {
  idEnEdition = null;
  formulaire.reset();
  champDisponible.checked = true;
  titreFormulaire.textContent = 'Ajouter un produit';
  boutonEnregistrer.textContent = 'Ajouter';
  boutonAnnuler.hidden = true;
}

function commencerModification(produit) {
  idEnEdition = produit.id;
  champNom.value = produit.nom;
  champPrix.value = String(produit.prix);
  champDescription.value = produit.description;
  champDisponible.checked = produit.disponible;
  titreFormulaire.textContent = 'Modifier le produit';
  boutonEnregistrer.textContent = 'Enregistrer les modifications';
  boutonAnnuler.hidden = false;
  formulaire.scrollIntoView({ behavior: 'smooth' });
  champNom.focus();
}

boutonAnnuler.addEventListener('click', reinitialiserFormulaire);

/* Contrôle de confort : le serveur refait les mêmes vérifications */
function verifierProduit(corps) {
  const erreurs = [];
  if (corps.nom.length < NOM_MIN || corps.nom.length > NOM_MAX) {
    erreurs.push(`Le nom doit contenir de ${NOM_MIN} à ${NOM_MAX} caractères.`);
  }
  if (corps.description.length > DESCRIPTION_MAX) {
    erreurs.push(`La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`);
  }
  if (typeof corps[CHAMP_PRIX] !== 'number' || corps[CHAMP_PRIX] > PRIX_MAX) {
    erreurs.push(`Le prix doit être un nombre entier de 0 à ${PRIX_MAX}.`);
  }
  return erreurs;
}

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();

  /* On accepte seulement des chiffres : « 12.5 », « -5 » et « abc » donnent NaN */
  const texteDuPrix = champPrix.value.trim();
  const corps = {
    nom: champNom.value.trim(),
    description: champDescription.value.trim(),
    [CHAMP_PRIX]: /^\d+$/.test(texteDuPrix) ? Number(texteDuPrix) : Number.NaN,
    disponible: champDisponible.checked,
  };

  const erreurs = verifierProduit(corps);
  if (erreurs.length > 0) {
    afficherMessages(zoneMessages, erreurs, 'erreur');
    return;
  }

  await pendant(boutonEnregistrer, async () => {
    const methode = idEnEdition === null ? 'POST' : 'PUT';
    const adresse = idEnEdition === null ? '/api/produits' : `/api/produits/${idEnEdition}`;
    const r = await appeler(methode, adresse, corps);
    if (!r.ok) {
      afficherMessages(zoneMessages, r.erreurs, 'erreur');
      return;
    }
    afficherMessages(zoneMessages, [idEnEdition === null ? 'Produit ajouté.' : 'Produit modifié.'], 'succes');
    reinitialiserFormulaire();
    await chargerProduits();
  });
});

/* ---- 8. BASCULER LA DISPONIBILITÉ ----
   On renvoie le produit complet avec « disponible » inversé
   (le PUT du serveur valide tous les champs). */
async function basculerDisponibilite(produit) {
  const corps = {
    nom: produit.nom,
    description: produit.description,
    [CHAMP_PRIX]: produit.prix,
    disponible: !produit.disponible,
  };
  const r = await appeler('PUT', `/api/produits/${produit.id}`, corps);
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  await chargerProduits();
}

/* ---- 9. SUPPRIMER ----
   Les commandes déjà passées gardent leur historique : nom et prix y sont copiés. */
async function supprimer(produit) {
  
  /* On remplit le texte de la boîte, puis on passe l'ÉLÉMENT <dialog> à la fonction */
  texteSuppression.textContent = `« ${produit.nom} » sera retiré de votre catalogue. Les commandes déjà passées gardent leur historique.`;
  const confirme = await demanderConfirmation(dialogueSuppression);
  if (!confirme) return;

  const r = await appeler('DELETE', `/api/produits/${produit.id}`);
  if (!r.ok) {
    afficherMessages(zoneMessages, r.erreurs, 'erreur');
    return;
  }
  if (idEnEdition === produit.id) reinitialiserFormulaire();
  afficherMessages(zoneMessages, ['Produit supprimé.'], 'succes');
  await chargerProduits();
}

/* ---- 10. DÉMARRAGE ---- */
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
  await chargerProduits();
}

demarrer();