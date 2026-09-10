#!/usr/bin/env node
/** Petit serveur local pour prévisualiser dist/ — node scripts/serve.js */
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 4000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json'
};

createServer((req, res) => {
  const demande = decodeURIComponent(req.url.split('?')[0]);
  let fichier = path.normalize(path.join(RACINE, demande));

  if (!fichier.startsWith(RACINE)) { res.writeHead(403); return res.end('403'); }
  if (fs.existsSync(fichier) && fs.statSync(fichier).isDirectory()) {
    fichier = path.join(fichier, 'index.html');
  }
  if (!fs.existsSync(fichier)) { res.writeHead(404); return res.end('404 — page introuvable'); }

  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
  fs.createReadStream(fichier).pipe(res);
}).listen(PORT, () => console.log(`→ http://localhost:${PORT}`));
