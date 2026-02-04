#!/usr/bin/env node
/**
 * Lädt die IP-Symcon Modulreferenz (Geräte) von symcon.de und erzeugt
 * libs/mcp-server/data/modulreferenz-geraete.json für das MCP.
 *
 * Aufruf: node scripts/fetch-modulreferenz.mjs
 * Quelle: https://www.symcon.de/de/service/dokumentation/modulreferenz/geraete/
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://www.symcon.de';
const URL = `${BASE}/de/service/dokumentation/modulreferenz/geraete/`;
const OUT_DIR = join(__dirname, '..', 'libs', 'mcp-server', 'data');
const OUT_JSON = join(OUT_DIR, 'modulreferenz-geraete.json');

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

/**
 * Parst HTML der Geräte-Übersichtsseite.
 * Erwartet: Abschnitte mit h3 (Kategorie), Tabellen mit Links [Text](url) und Beschreibung.
 */
function parseHtml(html) {
  const categories = [];
  // Kategorien: h3 mit Link zu .../geraete/CAT/ oder Überschrift vor Tabellen
  const categoryBlock = /<h3[^>]*>[\s\S]*?<a[^>]+href="(\/de\/service\/dokumentation\/modulreferenz\/geraete\/[^"/]+)\/[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?<\/h3>/gi;
  const linkRow = /<a[^>]+href="(\/de\/service\/dokumentation\/modulreferenz\/geraete\/[^"]+)"[^>]*>([^<]+)<\/a>\s*\|?\s*([^|<]*(?:\|[^|]*)?)/gi;
  // Alternative: Zeilen mit [Name](url)|Beschreibung|
  const markdownStyle = /\[([^\]]+)\]\((\/de\/service\/dokumentation\/modulreferenz\/geraete\/[^)]+)\)\|([^|]*)\|/g;

  let curCategory = null;
  let curDescription = '';
  const lines = html.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // h3: neue Kategorie
    const h3Match = line.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="\/de\/service\/dokumentation\/modulreferenz\/geraete\/([^"/]+)\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (h3Match) {
      if (curCategory) categories.push(curCategory);
      const [, catId, name] = h3Match;
      curCategory = {
        id: (catId || '').replace(/\/$/, ''),
        name: (name || '').trim(),
        description: '',
        functions: [],
      };
      curDescription = '';
      continue;
    }
    // Fett vor Kategorie-Beschreibung
    const boldMatch = line.match(/<strong>([^<]*)<\/strong>/);
    if (boldMatch && curCategory && !curCategory.description) {
      curCategory.description = (boldMatch[1] || '').trim();
      continue;
    }
    // Link-Zeile: [Name](url)|Beschreibung| (wenn HTML zu Markdown konvertiert) oder <a href="...">Name</a>
    const mdMatch = line.matchAll(markdownStyle);
    for (const m of mdMatch) {
      const name = (m[1] || '').trim();
      const url = (m[2] || '').trim();
      const desc = (m[3] || '').trim();
      if (!name || name === 'Geräteliste') continue;
      if (curCategory) {
        curCategory.functions.push({ name, description: desc, url: url.startsWith('http') ? url : BASE + url });
      }
    }
    // HTML-Link in Tabellenzeile
    const aMatch = line.match(/<a[^>]+href="(\/de\/service\/dokumentation\/modulreferenz\/geraete\/[^"]+)"[^>]*>([^<]+)<\/a>/);
    if (aMatch && curCategory) {
      const href = aMatch[1];
      const name = (aMatch[2] || '').trim();
      if (name && name !== 'Geräteliste') {
        const nextLine = lines[i + 1] || '';
        const descMatch = nextLine.match(/<td[^>]*>([^<]*)<\/td>/) || nextLine.match(/\|\s*([^|]+)\|/);
        curCategory.functions.push({
          name,
          description: descMatch ? (descMatch[1] || '').trim() : '',
          url: href.startsWith('http') ? href : BASE + href,
        });
      }
    }
  }
  if (curCategory) categories.push(curCategory);

  // Fallback: alle Links aus der Seite nach Kategorie gruppieren
  if (categories.length === 0) {
    const linkRegex = /<a[^>]+href="(\/de\/service\/dokumentation\/modulreferenz\/geraete\/([^/]+)\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    const byCat = new Map();
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const [, fullPath, catId, name] = m;
      const n = (name || '').trim();
      if (!n || n === 'Geräteliste' || n === '« Zurück') continue;
      if (!byCat.has(catId)) byCat.set(catId, { id: catId, name: catId, description: '', functions: [] });
      byCat.get(catId).functions.push({
        name: n,
        description: '',
        url: fullPath.startsWith('http') ? fullPath : BASE + fullPath,
      });
    }
    categories.push(...byCat.values());
  }

  return categories;
}

/** Holt alle Links von einer Kategorieseite (z. B. 1-wire/) und fügt sie als functions hinzu. */
function parseCategoryPage(html, catId) {
  const functions = [];
  const linkRegex = /<a[^>]+href="(\/de\/service\/dokumentation\/modulreferenz\/geraete\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  const seen = new Set();
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const name = (m[2] || '').trim();
    if (!name || name === 'Geräteliste' || name === '« Zurück' || name.length > 80 || name.length < 2) continue;
    if (name === 'DE' || /^[A-Z]{2}$/.test(name)) continue; // Sprach-Links etc. auslassen
    const fullUrl = href.startsWith('http') ? href : BASE + href;
    const key = fullUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    functions.push({ name, description: '', url: fullUrl });
  }
  return functions;
}

async function main() {
  console.log('Fetching', URL);
  const html = await fetchPage(URL);
  let categories = parseHtml(html);
  // Rekursiv: jede Kategorieseite abrufen und alle Geräte/Funktions-Links sammeln
  const deep = process.argv.includes('--deep');
  if (deep || categories.every((c) => c.functions.length <= 1)) {
    console.log('Fetching category pages for full function list...');
    for (const cat of categories) {
      const catUrl = cat.functions[0]?.url || `${BASE}/de/service/dokumentation/modulreferenz/geraete/${cat.id}/`;
      try {
        const catHtml = await fetchPage(catUrl);
        const funcs = parseCategoryPage(catHtml, cat.id);
        if (funcs.length > 0) {
          cat.functions = funcs;
          console.log('  ', cat.id, ':', funcs.length, 'links');
        }
      } catch (e) {
        console.warn('  ', cat.id, ':', e.message);
      }
    }
  }
  const payload = {
    sourceUrl: URL,
    updated: new Date().toISOString(),
    categories: categories.filter((c) => c.functions.length > 0 || c.description),
  };
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
  const totalFuncs = payload.categories.reduce((s, c) => s + c.functions.length, 0);
  console.log('Written', OUT_JSON, '–', payload.categories.length, 'categories,', totalFuncs, 'functions/links');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
