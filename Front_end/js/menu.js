/* ===== menu.js : le menu principal, selon le rôle ===== */
import { creerElement, pendant } from './outils.js';
import { lireUtilisateur, deconnecter } from './session.js';

/*
  Les entrées du menu pour chaque type de visiteur.
  🔧 À MODIFIER : pour ajouter une page au menu, ajoute une ligne ici.
  Les pages citées seront créées aux étapes 28 à 32 : leur lien répond
  "Cannot GET" tant qu'elles n'existent pas.
*/
const MENUS = {
  visiteur: [
    { texte: 'Établissements', lien: '/liste-etablissements.html' },
    { texte: 'Connexion', lien: '/connexion.html' },
    { texte: 'Inscription', lien: '/inscription.html' }
  ],
  client: [
    { texte: 'Établissements', lien: '/liste-etablissements.html' },
    { texte: 'Panier', lien: '/panier.html' },
    { texte: 'Mes commandes', lien: '/mes-commandes.html' }
  ],
  commercant: [
    { texte: 'Commandes', lien: '/commercant/tableau-de-bord.html' },
    { texte: 'Historique', lien: '/commercant/historique-commandes.html' },
    { texte: 'Ma boutique', lien: '/commercant/ma-boutique.html' },
    { texte: 'Produits', lien: '/commercant/produits.html' }
  ]
};

const menu = document.getElementById('menu');

async function monterMenu() {
  const utilisateur = await lireUtilisateur();
  const role = utilisateur ? utilisateur.role : 'visiteur';

  menu.replaceChildren();

  (MENUS[role] || MENUS.visiteur).forEach((entree) => {
    const lien = creerElement('a', entree.texte);

    lien.href = entree.lien;

    // Marque la page courante (lue par les lecteurs d'écran)
    if (window.location.pathname === entree.lien) {
      lien.setAttribute('aria-current', 'page');
    }

    menu.append(lien);
  });

  if (utilisateur) {
    // textContent : un email contenant du HTML s'affiche comme du texte
    menu.append(creerElement('span', utilisateur.email, 'discret menu-email'));

    const bouton = creerElement('button', 'Déconnexion', 'puce');

    bouton.type = 'button';
    bouton.addEventListener('click', () => pendant(bouton, deconnecter));

    menu.append(bouton);
  }
}

// La page doit contenir <nav id="menu">
if (menu) {
  monterMenu();
}



