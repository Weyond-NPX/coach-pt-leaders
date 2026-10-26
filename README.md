# Landing « Bilan Forme » — template multi-coachs

Un template unique, un fichier JSON par coach, une page HTML autonome en sortie.
Objectif : **décliner un nouveau coach en moins de 15 minutes.**

---

## Ce que ce template change par rapport à la page actuelle

La page actuelle envoie les gens vers le calendrier sans jamais leur dire ce qu'ils réservent.
C'est ce que les coachs remontent mot pour mot dans les questionnaires : « ils réservent mais
dès le premier appel on voit qu'ils ont pas compris l'objectif du rdv », « ils pensaient que
c'était une première séance », « tour gratuit du club inclus dans le prix Basic-Fit ».

Quatre blocs ont été ajoutés pour traiter exactement ça :

| Bloc | Ce qu'il corrige |
| --- | --- |
| **« Vous vous reconnaissez ? »** | Rien ne parlait aux 30-45 ans qui veulent s'y remettre |
| **Ce que c'est / ce que ce n'est pas** | La confusion avec la visite de salle et l'abonnement |
| **Valeur du bilan** (90 € barré → offert) | Le rendez-vous gratuit perçu comme sans valeur |
| **Avis Google + témoignages** | L'absence totale de preuve sociale avant la réservation |
| **Engagement renforcé** | Le no-show : les 3 rappels sont annoncés dès la page |

Le déroulé en 3 étapes est désormais minuté (15 / 30 / 15 min) et la FAQ répond
aux deux objections dominantes du portefeuille : le prix et l'engagement.

---

## Démarrage

```bash
npm run build          # génère tous les coachs dans dist/
npm run dev            # génère + sert sur http://localhost:4000
node build.js tristan  # génère un seul coach
```

Aucune dépendance à installer. Node 18 minimum.

---

## Ajouter un coach — la procédure en 15 minutes

**1. Dupliquer une config** *(1 min)*

```bash
cp config/thomas-vaysse.json config/prenom-nom.json
```

Le nom du fichier devient le slug du site (`dist/prenom-nom/`).

**2. Remplir les 4 champs obligatoires** *(4 min)*

```jsonc
{
  "coach":  { "prenom": "…", "nom": "…", "ville": "…" },
  "salle":  { "nom": "…", "adresse": "…", "codePostal": "…", "ville": "…" },
  "calendrier": { "urlEmbed": "https://api.leadconnectorhq.com/widget/booking/<ID>" },
  "meta":   { "titre": "…", "description": "…" }
}
```

La carte Google se génère toute seule à partir de l'adresse — aucune clé API,
aucun code d'intégration à récupérer. L'URL du site (`meta.url`) se déduit
automatiquement de `site.base` + le slug : rien à saisir.

**3. Coller les avis Google** *(5 min)*

Ouvrir la fiche Google Business du coach, onglet Avis, et recopier 3 à 4 avis réels :

```jsonc
"avis": {
  "note": "4,9",
  "nombre": "37",
  "lienProfil": "https://g.page/r/…",
  "liste": [
    { "texte": "…", "auteur": "Julie M.", "initiale": "J", "date": "juillet 2026", "note": "5" }
  ]
}
```

> **Uniquement de vrais avis.** Si le coach n'en a pas encore, laisser `liste: []` :
> la section est automatiquement masquée et le build vous le signale. Une page sans
> preuve sociale vaut mieux qu'une page avec des témoignages inventés.

Alternative automatique, si vous avez une clé Google Cloud avec « Places API (New) » :

```bash
# renseigner d'abord "placeId" dans avis
GOOGLE_API_KEY=xxx node scripts/fetch-avis.js prenom-nom
```

**4. Les images** *(3 min)*

Soit des URL absolues dans `visuels` (les images déjà hébergées sur le site actuel),
soit des fichiers déposés dans `assets/prenom-nom/` — ils sont copiés à la génération.
`assets/commun/` sert pour les visuels partagés entre tous les coachs.

**5. Générer et publier** *(2 min)*

```bash
node build.js          # régénère tout, y compris l'annuaire
git push               # Netlify redéploie et la nouvelle page est en ligne
```

Le nouveau coach apparaît immédiatement dans l'annuaire, à l'adresse
`bilan-forme.netlify.app/prenom-nom`.

---

## Un seul site, une adresse par coach

Tout est publié sur **un seul site Netlify**. Le nom du fichier de config
devient l'adresse :

```
config/thomas-vaysse.json      →  bilan-forme.netlify.app/thomas-vaysse
config/tristan-maffettone.json →  bilan-forme.netlify.app/tristan-maffettone
```

À la racine, `bilan-forme.netlify.app/` affiche **l'annuaire des coachs** :
la liste complète avec ville, salle et lien direct, un champ de filtre (raccourci `/`),
et un badge « à compléter » sur les fiches où il reste un `REMPLACER` ou un champ
obligatoire vide. C'est la page à garder en favori pour ouvrir n'importe quelle
page de coach en deux secondes pendant un appel.

Cette page est en `noindex` : elle ne remontera jamais dans Google. Pour la
protéger complètement, activer *Site configuration → Access & security →
Password protection* côté Netlify.

Le domaine commun se règle à un seul endroit, dans `config/_defaults.json` :

```jsonc
"site": {
  "nom": "Bilan Forme",
  "base": "https://bilan-forme.netlify.app"
}
```

Il alimente les balises canoniques et les partages Open Graph de toutes les pages.
Si un coach prend un jour son propre nom de domaine, il suffit de lui remettre un
`meta.url` dans sa config et de créer un second site Netlify sur le même dépôt
(voir les commentaires dans `netlify.toml`).

---

## Modifier un seul coach

Chaque fichier de config **écrase** `_defaults.json`, pour ce coach uniquement.
Vous ne réécrivez que ce qui change ; le reste suit le modèle commun.

### Changer le copywriting

Tout le texte de la page vit dans `textes.*`. Exemple, dans `config/prenom-nom.json` :

```jsonc
"textes": {
  "h1Html": "Se remettre au sport <span class=\"souligne\">après 40 ans</span>, sans se blesser.",
  "ctaPrincipal": "Je réserve ma place",
  "situationsTitre": "Votre corps a changé. Votre entraînement, non."
}
```

Les autres phrases, la FAQ et le reste restent inchangés.
Les clés en `-Html` acceptent du HTML simple — pratique pour mettre un mot en
couleur d'accent avec `<span class="souligne">…</span>`.

**Les textes peuvent contenir des variables.** Écrire
`"Une heure avec {{coach.prenom}} à {{coach.ville}}"` produit
« Une heure avec Camille à Bordeaux » — inutile de retaper le prénom partout.

### Deux règles à connaître

| Type | Comportement | Conséquence |
| --- | --- | --- |
| Objet `{ }` | **fusionné** | `"offre": { "valeur": "120 €" }` ne change que le prix |
| Liste `[ ]` | **remplacée** | pour modifier une étape, recopier les trois |

### Masquer une section

Une liste vide supprime la section correspondante sur cette page :

```jsonc
"atouts": [],        // enlève le bloc « pourquoi cette salle »
"situations": [],    // enlève « vous vous reconnaissez ? »
"faq": []            // enlève la FAQ
```

Sections concernées : `situations`, `etapes`, `atouts`, `faq`, `avis`.
Chaque liste est limitée à 3 éléments (sauf la FAQ) : le build prévient si on dépasse.

### Les photos

| Clé | Où | Format conseillé |
| --- | --- | --- |
| `visuels.hero` | portrait du coach, en haut | vertical, ~1100 px |
| `etapes[].image` | les 3 temps du bilan (une capture de vidéo suffit) | horizontal 16:10, ~1200 px |
| `salle.photo` | entrée de la salle, section « Le lieu » | horizontal 16:9, ~1200 px |
| `suite.coaching.image` | option « coaching individuel » | horizontal, ~1600 px |

Déposer les fichiers dans `assets/<slug>/` (ou `assets/commun/` s'ils servent à
tout le monde), puis écrire `"assets/nom-du-fichier.jpg"`. Sans photo, le temps
du bilan affiche un pictogramme et la carte du lieu une pastille : la page reste
propre, et le build liste ce qui manque. Les photos brutes (plusieurs Mo) vont dans
`assets/originaux/`, qui n'est pas publié : en publier une version réduite.

### Les avis Google

Deux options, dans `avis` :

```jsonc
// 1. Un widget d'avis (Elfsight, Trustindex, Featurable…) — collez le code fourni
"avis": { "widgetHtml": "<div class=\"elfsight-app-xxxx\"></div><script src=\"…\" async></script>" }

// 2. Ou des avis recopiés à la main depuis la fiche Google
"avis": { "note": "4,9", "nombre": "37", "lienProfil": "…", "liste": [ … ] }
```

Le widget a la priorité s'il est rempli. Si les deux sont vides, la section
disparaît. Google ne propose pas de widget officiel gratuit : il faut passer par
un de ces services, ou recopier les avis (5 minutes, zéro dépendance).

### L'encart d'autorité

Un bandeau de chiffres clés, commun à tous les coachs, affiché avant les avis :

```jsonc
"autorite": { "anneesExperience": "8", "clientsAccompagnes": "150" }
```

Le nombre d'avis Google (et la note) vient de `avis.nombre` / `avis.note`, avec un lien
vers `avis.lienProfil`. Chaque chiffre vide est masqué ; si tout est vide, l'encart
disparaît et le build le signale. Uniquement des chiffres réels.

### Changer les couleurs

La charte par défaut est celle de Weyond (palette de référence :
`assets/charte/palette-weyond.png`). Trois teintes forment le dégradé utilisé
sur les boutons, les pictogrammes, les grands chiffres et le bloc de prix :

```jsonc
"marque": {
  "encre":       "#343838",   // texte et blocs sombres (anthracite)
  "accent":      "#96905E",   // début du dégradé (olive)
  "accent2":     "#7A7754",   // milieu
  "accent3":     "#5E5D4A",   // fin (kaki)
  "accentFonce": "#6B6740",   // petits textes en couleur : l'olive pur n'est pas assez lisible
  "accentClair": "#EDEBDF",   // fonds légers (pastilles creuses, badges)
  "gris":        "#ADAEAE",   // textes secondaires sur fond sombre, puces « non »
  "vert":        "#63AF2E",   // signal « disponible » : point animé, bandeau
  "blanc":       "#FEFEFE",   // cartes
  "logo":        "assets/logo-weyond-noir.png",  // pied de page et annuaire
  "pictogramme": "assets/Pictogramme.png"        // en-tête et favicon
}
```

Les fichiers de logo vivent dans `assets/commun/`. `assets/charte/` garde les
originaux et la palette ; ce dossier n'est pas publié.

### Les pictogrammes

Chaque bloc de contenu accepte une clé `icone` :

```jsonc
"situations": [ { "icone": "boussole", "titre": "…", "texte": "…" } ]
```

Noms disponibles : `agenda`, `coeur`, `boussole`, `clipboard`, `jauge`, `carte`,
`graphique`, `ampoule`, `document`, `diplome`, `horloge`, `activite`, `chrono`,
`etiquette`, `cadenas`, `calendrier`, `message`, `userCheck`, `bouclier`,
`etoile`, `eclair`, `pin`. Sans clé `icone`, la pastille disparaît simplement.
Pour en ajouter un, créer un `<symbol id="i-monicone">` dans `template/page.html`.

### Refaire toute la mise en page pour un coach

Si le texte ne suffit pas, copier `template/page.html` en
`template/page-prenom-nom.html` et le modifier librement. La génération l'utilise
automatiquement pour ce coach, et le signale dans la sortie :

```
✓ /prenom-nom  →  dist/prenom-nom/index.html  [mise en page dédiée : page-prenom-nom.html]
```

Les autres coachs continuent d'utiliser `page.html`.

Le fichier `config/_exemple-surcharges.json` rassemble tous ces cas, commentés.
Il n'est pas généré (son nom commence par `_`).

---

## Ce qu'on peut personnaliser sans toucher au code

Un coach qui reçoit dans deux salles ajoute simplement :

```jsonc
"lieuxSupplementaires": [
  { "nom": "Basic-Fit Cannes Forville", "adresse": "17 Rue du Marché Forville, 06150 Cannes" }
]
```

---

## Arborescence

```
config/
  _defaults.json          contenu commun à tous les coachs (dont tous les textes)
  _exemple-surcharges.json  aide-mémoire des personnalisations possibles
  thomas-vaysse.json      config coach (2 salles : Antibes + Cannes)
  tristan-maffettone.json config coach pilote
template/
  page.html               la page coach — c'est ici qu'on modifie le design
  page-<slug>.html        (facultatif) mise en page dédiée à un seul coach
  index.html              l'annuaire affiché à la racine du site
scripts/
  fetch-avis.js           récupération optionnelle des avis via l'API Google Places
assets/
  commun/                 visuels partagés — contient un hero.jpg neutre de secours
  <slug>/                 visuels propres à un coach (facultatif)
build.js                  générateur
netlify.toml              config de déploiement
dist/                     sortie générée — ne pas versionner
  index.html              l'annuaire
  <slug>/index.html       une page par coach
```

---

## Vérifications faites automatiquement au build

Le générateur signale, sans bloquer :

- un champ obligatoire manquant (`coach.prenom`, `salle.adresse`, `calendrier.urlEmbed`) ;
- l'absence d'avis, qui masque la section preuve sociale.

À vérifier à la main avant de mettre en ligne : le calendrier GHL s'affiche bien
dans l'iframe, l'adresse de la salle est la bonne, et le lien vers la fiche Google
pointe sur le bon établissement.

---

## Mesurer si ça marche

Le seul indicateur qui compte pour ce chantier est le **taux de présence aux bilans**
(bilans réalisés ÷ bilans réservés), relevé dans le tableau de bord mensuel.

- Médiane du portefeuille en août 2026 : **40 %**
- Meilleur coach du portefeuille sur le même segment, même coût par prospect : **73 %**
- Objectif du pilote : **55 % au premier mois complet**

Relever aussi le taux de prise de rendez-vous : si la page filtre mieux l'intention,
il peut légèrement baisser pendant que la présence monte. C'est le résultat recherché.
