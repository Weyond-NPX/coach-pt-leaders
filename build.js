#!/usr/bin/env node
/**
 * Générateur de landing pages "Bilan Forme" — un site par coach.
 *
 *   node build.js              → génère tous les coachs présents dans config/
 *   node build.js tristan      → génère uniquement config/tristan-*.json
 *
 * Sortie : dist/<slug>/index.html   (fichier unique, autonome, glissable dans Netlify)
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONFIG_DIR = path.join(ROOT, 'config');
const TEMPLATE_DIR = path.join(ROOT, 'template');
const TEMPLATE = path.join(TEMPLATE_DIR, 'page.html');
const TEMPLATE_INDEX = path.join(TEMPLATE_DIR, 'index.html');
const DIST = path.join(ROOT, 'dist');

// ---------------------------------------------------------------- utilitaires

function get(obj, chemin) {
  return chemin.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fusion profonde : les valeurs du coach écrasent les valeurs par défaut. */
function fusion(base, sur) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const [k, v] of Object.entries(sur || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = fusion(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ------------------------------------------------------- moteur de templating
// Supporte : {{var}}  {{a.b}}  {{{html_brut}}}  {{#if x}}…{{else}}…{{/if}}
//            {{#each liste}}…{{this.champ}}…{{@index1}}…{{/each}}

function interpoler(tpl, ctx) {
  return tpl
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_m, k) => {
      const v = get(ctx, k);
      return v == null ? '' : String(v);
    })
    .replace(/\{\{\s*([\w.@]+)\s*\}\}/g, (_m, k) => {
      const v = get(ctx, k);
      return v == null ? '' : esc(v);
    });
}

/** Parseur de blocs conscient de l'imbrication (un {{#if}} peut en contenir un autre). */
function render(tpl, ctx) {
  const ouverture = /\{\{#(if|each)\s+([\w.@]+)\}\}/;
  const m = ouverture.exec(tpl);
  if (!m) return interpoler(tpl, ctx);

  const avant = tpl.slice(0, m.index);
  const type = m[1];
  const cle = m[2];
  const debutCorps = m.index + m[0].length;

  const balises = /\{\{#(?:if|each)\s+[\w.@]+\}\}|\{\{\/(?:if|each)\}\}|\{\{else\}\}/g;
  balises.lastIndex = debutCorps;

  let profondeur = 1;
  let idxElse = -1;
  let idxFin = -1;
  let longFin = 0;
  let b;

  while ((b = balises.exec(tpl))) {
    const s = b[0];
    if (s.startsWith('{{#')) {
      profondeur++;
    } else if (s === '{{else}}') {
      if (profondeur === 1 && idxElse === -1) idxElse = b.index;
    } else {
      profondeur--;
      if (profondeur === 0) {
        idxFin = b.index;
        longFin = s.length;
        break;
      }
    }
  }

  if (idxFin === -1) return interpoler(tpl, ctx); // bloc non fermé : on n'invente rien

  const corps = tpl.slice(debutCorps, idxFin);
  const suite = tpl.slice(idxFin + longFin);
  let sortie;

  if (type === 'each') {
    const arr = get(ctx, cle);
    sortie = Array.isArray(arr)
      ? arr
          .map((item, i) => {
            const c = corps.replace(/\{\{@index1\}\}/g, String(i + 1)).replace(/\{\{@index\}\}/g, String(i));
            return render(c, Object.assign({}, ctx, { this: item }));
          })
          .join('')
      : '';
  } else {
    const v = get(ctx, cle);
    const vrai = Array.isArray(v) ? v.length > 0 : Boolean(v);
    const decalage = idxElse - debutCorps;
    const siVrai = idxElse >= 0 ? corps.slice(0, decalage) : corps;
    const siFaux = idxElse >= 0 ? corps.slice(decalage + '{{else}}'.length) : '';
    sortie = render(vrai ? siVrai : siFaux, ctx);
  }

  return interpoler(avant, ctx) + sortie + render(suite, ctx);
}

// ------------------------------------------------------------ valeurs dérivées

function enrichir(cfg, slug) {
  cfg.slug = slug;

  const salle = cfg.salle || {};
  const codeVille = [salle.codePostal, salle.ville].filter(Boolean).join(' ');
  const adresseComplete = [salle.adresse, codeVille].filter(Boolean).join(', ');
  cfg.salle = Object.assign({}, salle, {
    adresseComplete,
    mapsEmbed: salle.mapsEmbed || `https://maps.google.com/maps?q=${encodeURIComponent(salle.nom + ' ' + adresseComplete)}&z=14&output=embed`,
    mapsLien: salle.mapsLien || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salle.nom + ' ' + adresseComplete)}`
  });

  // Compte les lieux proposés (certains coachs couvrent 2 salles)
  cfg.lieuxMultiples = Array.isArray(cfg.lieuxSupplementaires) && cfg.lieuxSupplementaires.length > 0;

  const avis = cfg.avis || {};
  const aDesAvis = Array.isArray(avis.liste) && avis.liste.length > 0;
  const aUnWidget = Boolean(avis.widgetHtml && String(avis.widgetHtml).trim());
  cfg.avis = Object.assign({}, avis, {
    liste: Array.isArray(avis.liste) ? avis.liste : [],
    aDesAvis,
    aUnWidget,
    // La section preuve sociale s'affiche si l'un OU l'autre est renseigné.
    afficher: aDesAvis || aUnWidget
  });

  // Encart d'autorité : seuls les chiffres renseignés s'affichent.
  const autorite = cfg.autorite || {};
  const annees = String(autorite.anneesExperience || '').trim();
  const clients = String(autorite.clientsAccompagnes || '').trim();
  const nbAvis = String(cfg.avis.nombre || '').trim();
  const chiffres = [];
  if (annees) chiffres.push({ valeur: annees, label: parseInt(annees, 10) === 1 ? "an d'expérience" : "ans d'expérience" });
  if (clients) chiffres.push({ valeur: clients, label: 'clients accompagnés' });
  if (nbAvis) {
    chiffres.push({
      valeur: nbAvis,
      label: cfg.avis.note ? `avis Google, note ${cfg.avis.note}/5` : 'avis Google',
      lien: cfg.avis.lienProfil || ''
    });
  }
  cfg.autorite = Object.assign({}, autorite, { chiffres, afficher: chiffres.length > 0 });

  // Timecodes cumulés du protocole : "15 min" + "30 min" → 00:00 / 00:15 / 00:45
  let curseur = 0;
  const mm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  cfg.etapes = (cfg.etapes || []).map((e) => {
    const minutes = parseInt(String(e.duree).replace(/\D/g, ''), 10) || 0;
    const enrichie = Object.assign({}, e, { debut: mm(curseur), fin: mm(curseur + minutes), minutes });
    curseur += minutes;
    return enrichie;
  });
  cfg.dureeTotale = mm(curseur);

  // URL canonique : dérivée de site.base + slug, sauf si meta.url est renseignée à la main
  // (cas d'un coach qui aurait son propre nom de domaine).
  const base = String((cfg.site && cfg.site.base) || '').replace(/\/+$/, '');
  cfg.meta = Object.assign({}, cfg.meta);
  if (!cfg.meta.url && base) cfg.meta.url = `${base}/${slug}/`;
  cfg.chemin = `/${slug}`;

  cfg.anneeCourante = new Date().getFullYear();

  // Les textes de la config peuvent eux-mêmes contenir des variables,
  // par exemple « Une heure avec {{coach.prenom}} à {{coach.ville}} ».
  // Deux passes suffisent (une variable dans une variable dans une variable
  // ne s'est jamais vue en pratique).
  for (let passe = 0; passe < 2; passe++) resoudreTextes(cfg, cfg);

  return cfg;
}

/** Remplace les {{variables}} présentes dans les chaînes de la config elle-même. */
function resoudreTextes(noeud, ctx) {
  if (Array.isArray(noeud)) {
    noeud.forEach((v, i) => {
      if (typeof v === 'string') noeud[i] = interpoler(v, ctx);
      else if (v && typeof v === 'object') resoudreTextes(v, ctx);
    });
    return;
  }
  for (const [k, v] of Object.entries(noeud)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string') noeud[k] = interpoler(v, ctx);
    else if (v && typeof v === 'object') resoudreTextes(v, ctx);
  }
}

// ----------------------------------------------------------------- génération

function coachs(filtre) {
  return fs
    .readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .filter((f) => !filtre || f.toLowerCase().includes(filtre.toLowerCase()))
    .map((f) => f.replace(/\.json$/, ''));
}

function main() {
  const filtre = process.argv[2];
  const defauts = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, '_defaults.json'), 'utf8'));
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');

  const liste = coachs(filtre);
  if (liste.length === 0) {
    console.error(`Aucune config trouvée${filtre ? ` pour « ${filtre} »` : ''} dans config/`);
    process.exit(1);
  }

  fs.mkdirSync(DIST, { recursive: true });
  const avertissements = [];
  const resume = [];
  let dernierDefauts = defauts;

  for (const slug of liste) {
    const brut = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${slug}.json`), 'utf8'));
    // Copie profonde des valeurs par défaut : sans ça, les textes résolus d'un coach
    // (« Une heure avec Thomas à Antibes ») contamineraient les coachs suivants.
    const cfg = enrichir(fusion(structuredClone(defauts), brut), slug);

    // Contrôles avant publication
    const manquants = [];
    if (!cfg.coach || !cfg.coach.prenom) manquants.push('coach.prenom');
    if (!cfg.salle.nom || !cfg.salle.adresse) manquants.push('salle.adresse');
    if (!cfg.calendrier || !cfg.calendrier.urlEmbed) manquants.push('calendrier.urlEmbed');
    if (manquants.length) {
      avertissements.push(`  ${slug} — champs obligatoires manquants : ${manquants.join(', ')}`);
    }
    if (!cfg.avis.aDesAvis) {
      avertissements.push(`  ${slug} — aucun avis dans config.avis.liste → section preuve sociale masquée`);
    }
    if (!cfg.autorite.afficher) {
      avertissements.push(`  ${slug} — encart d'autorité masqué (autorite.anneesExperience, autorite.clientsAccompagnes et avis.nombre vides)`);
    }
    const sansImage =cfg.etapes.map((e, i) => (e.image ? null : i + 1)).filter(Boolean);
    if (sansImage.length) {
      avertissements.push(`  ${slug} — bilan : temps ${sansImage.join(', ')} sans photo (etapes[].image) → pictogramme à la place`);
    }
    if (!cfg.salle.photo) {
      avertissements.push(`  ${slug} — pas de photo de la salle (salle.photo)`);
    }
    for (const [cle, liste] of Object.entries({ situations: cfg.situations, etapes: cfg.etapes, hesitation: cfg.hesitation, atouts: cfg.atouts })) {
      if (Array.isArray(liste) && liste.length > 3) {
        avertissements.push(`  ${slug} — ${cle} contient ${liste.length} éléments (3 maximum conseillés)`);
      }
    }

    // Un coach peut avoir sa propre mise en page : template/page-<slug>.html
    const tplPerso = path.join(TEMPLATE_DIR, `page-${slug}.html`);
    const surMesure = fs.existsSync(tplPerso);
    const modele = surMesure ? fs.readFileSync(tplPerso, 'utf8') : tpl;

    const html = render(modele, cfg);
    const dossier = path.join(DIST, slug);
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, 'index.html'), html, 'utf8');

    // Images : assets/commun/ pour tout le monde, assets/<slug>/ pour ce coach.
    // (Inutile si les visuels du JSON sont des URL absolues.)
    for (const src of [path.join(ROOT, 'assets', 'commun'), path.join(ROOT, 'assets', slug)]) {
      if (fs.existsSync(src)) fs.cpSync(src, path.join(dossier, 'assets'), { recursive: true });
    }

    const ko = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
    console.log(
      `✓ /${slug}  →  dist/${slug}/index.html  (${ko} Ko)` +
        (surMesure ? `  [mise en page dédiée : page-${slug}.html]` : '')
    );

    const prenom = (cfg.coach && cfg.coach.prenom) || '';
    const nomFamille = (cfg.coach && cfg.coach.nom) || '';
    const aRemplacer = JSON.stringify(cfg).includes('REMPLACER') || manquants.length > 0;
    resume.push({
      slug,
      nom: `${prenom} ${nomFamille}`.trim() || slug,
      ville: (cfg.coach && cfg.coach.ville) || '—',
      salleNom: cfg.salle.nom || '—',
      salleVille: cfg.salle.adresseComplete || '',
      initiales: ((prenom[0] || slug[0] || '?') + (nomFamille[0] || '')).toUpperCase(),
      incomplet: aRemplacer,
      classeAlerte: aRemplacer ? ' incomplet' : '',
      recherche: [prenom, nomFamille, cfg.coach && cfg.coach.ville, cfg.salle.nom, cfg.salle.ville, slug]
        .filter(Boolean)
        .join(' ')
    });
    dernierDefauts = defauts;
  }

  // Page d'accueil : l'annuaire des coachs, à la racine du site
  resume.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const index = render(fs.readFileSync(TEMPLATE_INDEX, 'utf8'), {
    marque: dernierDefauts.marque,
    site: dernierDefauts.site || { nom: 'Bilan Forme', base: '' },
    coachs: resume,
    nbCoachs: resume.length,
    dateGeneration: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  });
  fs.writeFileSync(path.join(DIST, 'index.html'), index, 'utf8');

  // L'annuaire n'a besoin que du logo et du pictogramme, pas de toutes les photos.
  const marque = dernierDefauts.marque || {};
  for (const visuel of [marque.logo, marque.pictogramme]) {
    if (!visuel || /^https?:/.test(visuel)) continue;
    const src = path.join(ROOT, 'assets', 'commun', path.basename(visuel));
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
      fs.copyFileSync(src, path.join(DIST, 'assets', path.basename(visuel)));
    }
  }
  console.log('✓ /          →  dist/index.html  (annuaire des coachs)');

  if (avertissements.length) {
    console.log('\nÀ vérifier avant mise en ligne :');
    avertissements.forEach((a) => console.log(a));
  }
  console.log(`\n${liste.length} site(s) généré(s) dans dist/`);
}

main();
