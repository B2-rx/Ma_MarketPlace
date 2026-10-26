/* ===== Bloc 1 : importer les outils ===== */
const express = require('express');
const db = require('../db');
const { exigerRole } = require('../middlewares/auth');
const { chargerBoutique } = require('../middlewares/boutique');
const {
  STATUTS,
  FACTEUR,
  LIBELLES_STATUTS,
  STATUT_ANNULE,
  ANNULE_PAR_COMMERCANT,
  TRANSITIONS_COMMERCANT , 
  STATUTS_FINAUX
} = require('../constantes');

const router = express.Router();


/* ===== Bloc 2 : réglages ===== */

// 🔧 À MODIFIER : nombre maximum de commandes renvoyées dans la liste
const LIMITE_LISTE = 100;

// 🔧 À MODIFIER : nombre de commandes par page dans l'historique
const LIMITE_PAR_DEFAUT = 20;
const LIMITE_MAX = 50;



/* ===== Bloc 3 : requêtes SQL préparées ===== */

/*
  Liste des commandes de LA boutique, les plus récentes d'abord.
  "? IS NULL OR statut = ?" : sans filtre, tous les statuts passent.
*/
const listerCommandes = db.prepare(`
  SELECT
    c.id, c.statut, c.annule_par, c.total_entier,
    c.date_creation, c.date_mise_a_jour,
    (SELECT SUM(quantite) FROM commande_lignes WHERE commande_id = c.id) AS nombre_articles
  FROM commandes c
  WHERE c.boutique_id = ? AND (? IS NULL OR c.statut = ?)
  ORDER BY c.id DESC
  LIMIT ?
`);

// Double condition : l'id de la commande ET la boutique du commerçant
const lireCommande = db.prepare(`
  SELECT
    c.id, c.statut, c.annule_par, c.total_entier,
    c.date_creation, c.date_mise_a_jour,
    c.adresse_livraison,
    u.telephone AS client_telephone,
    (SELECT SUM(quantite) FROM commande_lignes WHERE commande_id = c.id) AS nombre_articles
  FROM commandes c
  JOIN utilisateurs u ON u.id = c.utilisateur_id
  WHERE c.id = ? AND c.boutique_id = ?
`);

const lireLignes = db.prepare(`
  SELECT produit_id, nom, prix_unitaire_entier, quantite
  FROM commande_lignes
  WHERE commande_id = ?
  ORDER BY id
`);

/*
  Changement de statut : la condition "AND statut = ?" reçoit le statut qu'on
  vient de LIRE. Si le client a annulé entre-temps, il ne correspond plus :
  aucune ligne n'est modifiée, et on répond 409.
*/
const changerStatut = db.prepare(`
  UPDATE commandes
  SET statut = ?, annule_par = ?, date_mise_a_jour = datetime('now')
  WHERE id = ? AND boutique_id = ? AND statut = ?
`);

/*
  Un "?" par statut final. Cette liste vient d'une constante du code,
  jamais d'une donnée envoyée par l'utilisateur : il n'y a aucun risque.
*/
const marqueursFinaux = STATUTS_FINAUX.map(() => '?').join(', ');

/*
  Une page de l'historique, de la plus récemment CLÔTURÉE à la plus ancienne.
  LIMIT = taille de la page, OFFSET = nombre de commandes à sauter.
  Ordre des "?" : boutique, statuts finaux, filtre (deux fois), limite, décalage.
*/
const listerHistorique = db.prepare(`
  SELECT
    c.id, c.statut, c.annule_par, c.total_entier,
    c.date_creation, c.date_mise_a_jour,
    (SELECT SUM(quantite) FROM commande_lignes WHERE commande_id = c.id) AS nombre_articles
  FROM commandes c
  WHERE c.boutique_id = ?
    AND c.statut IN (${marqueursFinaux})
    AND (? IS NULL OR c.statut = ?)
  ORDER BY c.date_mise_a_jour DESC, c.id DESC
  LIMIT ? OFFSET ?
`);

// Nombre total de commandes correspondant au filtre (pour calculer les pages)
const compterHistorique = db.prepare(`
  SELECT COUNT(*) AS total
  FROM commandes
  WHERE boutique_id = ?
    AND statut IN (${marqueursFinaux})
    AND (? IS NULL OR statut = ?)
`);

/*
  Résumé de TOUT l'historique, indépendant de la page affichée.
  GROUP BY regroupe les lignes par statut : une ligne de résultat par statut.
*/
const resumerHistorique = db.prepare(`
  SELECT statut, COUNT(*) AS nombre, SUM(total_entier) AS somme
  FROM commandes
  WHERE boutique_id = ? AND statut IN (${marqueursFinaux})
  GROUP BY statut
`);



/* ===== Bloc 4 : outils ===== */

// Boutons à afficher pour ce statut : [{ statut, libelle }, ...]
function actionsPossibles(statut) {
  return (TRANSITIONS_COMMERCANT[statut] || []).map((transition) => ({
    statut: transition.vers,
    libelle: transition.libelle
  }));
}

// Résumé d'une commande (sans ses lignes), utilisé par la liste
function formaterResume(commande) {
  return {
    id: commande.id,
    statut: commande.statut,
    statutLibelle: LIBELLES_STATUTS[commande.statut],

    // "client" ou "commercant" si la commande est annulée, sinon null
    annulePar: commande.annule_par,

    nombreArticles: commande.nombre_articles,
    total: commande.total_entier / FACTEUR,

    // Format SQLite : "2026-10-24 12:30:00", en heure UTC
    dateCreation: commande.date_creation,
    dateMiseAJour: commande.date_mise_a_jour,

    // Les boutons du tableau de bord : le frontend n'a pas à connaître les règles
    actions: actionsPossibles(commande.statut)
  };
}

// Commande complète : le résumé + le téléphone du client + ses lignes
function formaterDetail(commande, lignes) {
  return {
    ...formaterResume(commande),

    // Pour joindre le client. L'email n'est JAMAIS communiqué.
    client: { telephone: commande.client_telephone },

    // Où livrer. Visible seulement ici (détail), jamais dans la liste ni l'historique
    adresseLivraison: commande.adresse_livraison,


    lignes: lignes.map((ligne) => ({
      produitId: ligne.produit_id,
      nom: ligne.nom,
      prix: ligne.prix_unitaire_entier / FACTEUR,
      quantite: ligne.quantite,
      sousTotal: (ligne.prix_unitaire_entier * ligne.quantite) / FACTEUR
    }))
  };
}

// Lit l'identifiant dans l'adresse. Renvoie null s'il est invalide.
function lireId(req) {
  const id = Number(req.params.id);

  return Number.isInteger(id) && id > 0 ? id : null;
}

/*
  Lit un entier positif dans l'adresse (?page=2).
  Renvoie la valeur par défaut si le paramètre est absent, et null s'il est
  invalide : texte, décimal, négatif, hors limites, ou répété (?page=1&page=2).
*/
function lireEntier(valeur, defaut, min, max) {
  if (valeur === undefined) {
    return defaut;
  }

  if (typeof valeur !== 'string' || !/^\d+$/.test(valeur)) {
    return null;
  }

  const nombre = Number(valeur);

  return nombre >= min && nombre <= max ? nombre : null;
}




/* ===== Bloc 5 : les gardiens de TOUTES les routes de ce fichier ===== */

// 1) seul un commerçant connecté passe, 2) on retrouve sa boutique
router.use(exigerRole('commercant'), chargerBoutique);


/* ===== Bloc 6 : GET / (liste des commandes) ===== */

/*
  Exemples :
    /api/commercant/commandes
    /api/commercant/commandes?statut=en_attente
*/
router.get('/', (req, res) => {
  const statut = req.query.statut;

  // Le filtre doit être un statut connu (refuse aussi ?statut=a&statut=b)
  if (statut !== undefined && !STATUTS.includes(statut)) {
    return res.status(400).json({
      erreurs: [`Statut invalide (choisis parmi : ${STATUTS.join(', ')}).`]
    });
  }

  const filtre = statut === undefined ? null : statut;
  const commandes = listerCommandes.all(req.boutiqueId, filtre, filtre, LIMITE_LISTE);

  return res.json({ commandes: commandes.map(formaterResume) });
});

/* ===== Bloc 6bis : GET /historique (commandes clôturées) ===== */

/*
  ⚠️ Cette route DOIT être déclarée AVANT "/:id". Sinon Express lirait
  "historique" comme un identifiant de commande et répondrait 404.

  Exemples :
    /api/commercant/commandes/historique
    /api/commercant/commandes/historique?statut=terminee
    /api/commercant/commandes/historique?page=2&limite=10
*/
router.get('/historique', (req, res) => {
  const { statut } = req.query;
  const page = lireEntier(req.query.page, 1, 1, 10000);
  const limite = lireEntier(req.query.limite, LIMITE_PAR_DEFAUT, 1, LIMITE_MAX);

  if (page === null || limite === null) {
    return res.status(400).json({
      erreurs: [`Pagination invalide (page : entier positif, limite : de 1 à ${LIMITE_MAX}).`]
    });
  }

  // Le filtre doit être un statut FINAL (refuse aussi ?statut=a&statut=b)
  if (statut !== undefined && !STATUTS_FINAUX.includes(statut)) {
    return res.status(400).json({
      erreurs: [`Statut invalide (choisis parmi : ${STATUTS_FINAUX.join(', ')}).`]
    });
  }

  const filtre = statut === undefined ? null : statut;
  const decalage = (page - 1) * limite;

  const commandes = listerHistorique.all(
    req.boutiqueId, ...STATUTS_FINAUX, filtre, filtre, limite, decalage
  );

  const { total } = compterHistorique.get(req.boutiqueId, ...STATUTS_FINAUX, filtre, filtre);

  // Résumé : on part de zéros, puis on remplit avec ce que la base renvoie
  const resume = {
    terminees: { nombre: 0, chiffreAffaires: 0 },
    annulees: { nombre: 0 },
    refusees: { nombre: 0 }
  };

  resumerHistorique.all(req.boutiqueId, ...STATUTS_FINAUX).forEach((ligne) => {
    if (ligne.statut === 'terminee') {
      resume.terminees = { nombre: ligne.nombre, chiffreAffaires: ligne.somme / FACTEUR };
    } else if (ligne.statut === 'annulee') {
      resume.annulees = { nombre: ligne.nombre };
    } else if (ligne.statut === 'refusee') {
      resume.refusees = { nombre: ligne.nombre };
    }
  });

  return res.json({
    resume,
    pagination: { page, limite, total, pages: Math.ceil(total / limite) },
    commandes: commandes.map(formaterResume)
  });
});



/* ===== Bloc 7 : GET /:id (détail d'une commande) ===== */

/*
  404 (et non 403) quand la commande appartient à une autre boutique :
  on ne révèle pas qu'elle existe.
*/
router.get('/:id', (req, res) => {
  const id = lireId(req);

  if (id === null) {
    return res.status(404).json({ erreurs: ['Commande introuvable.'] });
  }

  const commande = lireCommande.get(id, req.boutiqueId);

  if (!commande) {
    return res.status(404).json({ erreurs: ['Commande introuvable.'] });
  }

  return res.json({ commande: formaterDetail(commande, lireLignes.all(id)) });
});


/* ===== Bloc 8 : PATCH /:id/statut (changer le statut) ===== */

/*
  Corps attendu : { "statut": "en_preparation" }
  PATCH = modification PARTIELLE (seul le statut change).
*/
router.patch('/:id/statut', (req, res) => {
  const id = lireId(req);

  if (id === null) {
    return res.status(404).json({ erreurs: ['Commande introuvable.'] });
  }

  const { statut: nouveauStatut } = req.body || {};

  // 400 : le statut demandé n'existe pas
  if (!STATUTS.includes(nouveauStatut)) {
    return res.status(400).json({
      erreurs: [`Statut invalide (choisis parmi : ${STATUTS.join(', ')}).`]
    });
  }

  const commande = lireCommande.get(id, req.boutiqueId);

  if (!commande) {
    return res.status(404).json({ erreurs: ['Commande introuvable.'] });
  }

  // Cette transition figure-t-elle dans la table des règles ?
  const transition = (TRANSITIONS_COMMERCANT[commande.statut] || [])
    .find((regle) => regle.vers === nouveauStatut);

  // 409 : la demande est bien formée, mais l'état actuel de la commande l'interdit
  if (!transition) {
    return res.status(409).json({
      erreurs: [
        'Changement impossible : '
        + `« ${LIBELLES_STATUTS[commande.statut]} » vers « ${LIBELLES_STATUTS[nouveauStatut]} ».`
      ]
    });
  }

  // On note qui annule uniquement quand la commande est annulée
  const annulePar = nouveauStatut === STATUT_ANNULE ? ANNULE_PAR_COMMERCANT : null;

  const resultat = changerStatut.run(
    nouveauStatut,
    annulePar,
    id,
    req.boutiqueId,
    commande.statut
  );

  // changes = 0 : le statut a changé entre la lecture et l'écriture
  if (resultat.changes === 0) {
    return res.status(409).json({
      erreurs: ['La commande vient de changer (le client l\'a peut-être annulée). Rafraîchis la page.']
    });
  }

  const miseAJour = lireCommande.get(id, req.boutiqueId);

  return res.json({
    message: 'Statut mis à jour.',
    commande: formaterDetail(miseAJour, lireLignes.all(id))
  });
});


/* ===== Bloc 9 : partager le router ===== */
module.exports = router;