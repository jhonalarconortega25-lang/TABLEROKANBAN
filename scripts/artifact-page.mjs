// Convierte dist-artifact/index.html en el fragmento que publica claude.ai
// (la plataforma añade <!doctype>, <html>, <head> y <body>).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-artifact/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n');
const title = html.match(/<title>.*?<\/title>/)[0];
const page = [
  title,
  pick(/<link href="https:\/\/fonts[^>]*>/g),
  pick(/<link rel="stylesheet"[^>]*>/g),
  pick(/<link rel="modulepreload"[^>]*>/g),
  '<style>html{background:#f2f1ec}</style>',
  '<div id="root"></div>',
  pick(/<script type="module"[^>]*><\/script>/g),
].filter(Boolean).join('\n');
writeFileSync('dist-artifact/page.html', page + '\n');
console.log(page);
