#!/usr/bin/env node
/**
 * Récupère les avis Google d'un coach et les écrit dans son fichier de config.
 *
 *   GOOGLE_API_KEY=xxx node scripts/fetch-avis.js thomas-vaysse
 *
 * Prérequis :
 *   1. Une clé API Google Cloud avec « Places API (New) » activée.
 *   2. Le champ avis.placeId renseigné dans config/<slug>.json.
 *      Pour le trouver : https://developers.google.com/maps/documentation/places/web-service/place-id
 *
 * L'API ne renvoie que les 5 avis les plus pertinents — c'est suffisant pour la page.
 * Le script n'invente rien : il recopie les avis réels tels que Google les renvoie.
 */

const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
const cle = process.env.GOOGLE_API_KEY;

if (!slug) {
  console.error('Usage : GOOGLE_API_KEY=xxx node scripts/fetch-avis.js <slug>');
  process.exit(1);
}
if (!cle) {
  console.error('Variable GOOGLE_API_KEY manquante.');
  process.exit(1);
}

const fichier = path.join(__dirname, '..', 'config', `${slug}.json`);
if (!fs.existsSync(fichier)) {
  console.error(`Config introuvable : config/${slug}.json`);
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const placeId = cfg.avis && cfg.avis.placeId;

if (!placeId) {
  console.error(`Renseignez d'abord avis.placeId dans config/${slug}.json`);
  process.exit(1);
}

const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

(async () => {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`;
  const rep = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': cle,
      'X-Goog-FieldMask': 'displayName,rating,userRatingCount,googleMapsUri,reviews'
    }
  });

  if (!rep.ok) {
    console.error(`Erreur API ${rep.status} : ${await rep.text()}`);
    process.exit(1);
  }

  const data = await rep.json();
  const avis = (data.reviews || [])
    .filter((r) => r.rating >= 4 && r.originalText && r.originalText.text)
    .slice(0, 4)
    .map((r) => {
      const d = new Date(r.publishTime);
      const auteur = (r.authorAttribution && r.authorAttribution.displayName) || 'Client';
      return {
        texte: r.originalText.text.replace(/\s+/g, ' ').trim(),
        auteur,
        initiale: auteur.trim().charAt(0).toUpperCase(),
        date: `${MOIS[d.getMonth()]} ${d.getFullYear()}`,
        note: String(r.rating)
      };
    });

  cfg.avis = Object.assign({}, cfg.avis, {
    note: data.rating ? String(data.rating).replace('.', ',') : '',
    nombre: data.userRatingCount ? String(data.userRatingCount) : '',
    lienProfil: data.googleMapsUri || cfg.avis.lienProfil || '',
    liste: avis
  });

  fs.writeFileSync(fichier, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  console.log(`✓ ${avis.length} avis écrits dans config/${slug}.json (note ${cfg.avis.note} / ${cfg.avis.nombre} avis)`);
  console.log('  Relancez « npm run build » pour régénérer la page.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
