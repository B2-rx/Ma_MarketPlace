/* ===== Bloc 1 : importer les outils ===== */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');


/* ===== Bloc 2 : réglages ===== */

// ".." remonte de scripts/ vers Back_end
const RACINE = path.join(__dirname, '..');
const BASE = path.join(RACINE, 'marketplace.db');
const UPLOADS = path.join(RACINE, 'uploads');
const DOSSIER_SAUVEGARDES = path.join(RACINE, 'sauvegardes');

// 🔧 À MODIFIER : nombre de sauvegardes conservées (les plus anciennes sont supprimées)
const NB_A_GARDER = 7;


/* ===== Bloc 3 : outils ===== */

// Fabrique un nom de dossier daté : 2026-10-25_15h36m00
function horodatage() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    + `_${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}`;
}


/* ===== Bloc 4 : la sauvegarde ===== */
async function sauvegarder() {
  if (!fs.existsSync(BASE)) {
    throw new Error('marketplace.db introuvable : rien à sauvegarder.');
  }

  const destination = path.join(DOSSIER_SAUVEGARDES, horodatage());
  fs.mkdirSync(destination, { recursive: true });

  /*
    On utilise la fonction backup() de SQLite et non une simple copie de fichier :
    elle donne une copie cohérente même si le serveur écrit en même temps.
  */
  const db = new Database(BASE, { readonly: true, fileMustExist: true });
  await db.backup(path.join(destination, 'marketplace.db'));
  db.close();

  // Copie des images (s'il y en a)
  if (fs.existsSync(UPLOADS)) {
    fs.cpSync(UPLOADS, path.join(destination, 'uploads'), { recursive: true });
  }

  console.log('Sauvegarde créée :', destination);

  /*
    Nettoyage : les noms de dossiers sont datés, donc le tri alphabétique
    est aussi un tri chronologique. On supprime les plus anciens.
  */
  const dossiers = fs.readdirSync(DOSSIER_SAUVEGARDES).sort();

  dossiers
    .slice(0, Math.max(0, dossiers.length - NB_A_GARDER))
    .forEach((ancien) => {
      fs.rmSync(path.join(DOSSIER_SAUVEGARDES, ancien), { recursive: true, force: true });
      console.log('Ancienne sauvegarde supprimée :', ancien);
    });
}

sauvegarder().catch((erreur) => {
  console.error('Échec de la sauvegarde :', erreur.message);
  process.exit(1);
});