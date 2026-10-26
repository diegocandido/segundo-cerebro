/* ingest.js - ingestao automatica de tarefas a partir do vault.

   Só entra aqui o que a gente consegue ler direto do disco (diario e memory).
   Fontes que exigem credencial (TLDV, Pipedrive, Whop, Composio, Apify) NAO
   passam por aqui: quem escreve essas e um agente/cron externo, que joga o
   resultado em state/todos.json pelo mesmo contrato (dedupe_key + origin).

   Toda tarefa gerada sai com dedupe_key estavel, pra rodar a ingestao mil vezes
   sem duplicar.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const scan = require('./scan');
const M = require('./mission');

const ROOT = scan.ROOT;

/* Convencoes do vault, configuraveis em config/workspace.json -> missionControl.
   Cada workspace nomeia suas pastas de um jeito: um chama de "memory/diario",
   outro de "Journal". Sem isso o parser simplesmente nao acharia nada. */
const DIARY_REL = M.mcOpt('diaryDir');
const DIARIO_DIR = path.join(ROOT, DIARY_REL);
const CLIENTES_DIR = path.join(ROOT, M.mcOpt('clientsDir'));
const PENDING_RE = new RegExp(M.mcOpt('pendingHeadingPattern'), 'i');

// ---------- helpers de texto ----------
function cleanTitle(s) {
  return String(s)
    .replace(/\*\*/g, '')                       // negrito
    .replace(/`/g, '')                          // code ticks
    .replace(/\[\[([^\]]+)\]\]/g, '$1')         // wikilink
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')    // link markdown
    .replace(/\s+/g, ' ')
    .replace(/^[-*]\s*/, '')
    .trim()
    .replace(/[.:;,]+$/, '')
    .trim();
}

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// "Pendências pra amanhã (11/08)" -> 2026-08-11, usando o ano do arquivo
function dueFromHeading(heading, fileDate) {
  const m = heading.match(/\((\d{1,2})\/(\d{1,2})\)/);
  if (m) {
    const year = fileDate.slice(0, 4);
    return year + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  if (/amanh/i.test(heading)) return addDays(fileDate, 1);
  if (/hoje/i.test(heading)) return fileDate;
  return null;
}

// nomes de cliente reais do vault, pra ligar a tarefa ao no do grafo
let clientCache = null;
function clientNames() {
  if (clientCache) return clientCache;
  try {
    clientCache = fs.readdirSync(CLIENTES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map(d => d.name);
  } catch { clientCache = []; }
  return clientCache;
}

function detectClient(title) {
  const hay = ' ' + title.toLowerCase() + ' ';
  for (const name of clientNames()) {
    const n = name.toLowerCase();
    if (n.length < 3) continue;
    if (hay.includes(' ' + n) || hay.includes(n + ' ') || hay.includes(n + ':')) return name;
  }
  return null;
}

// ---------- diario ----------
function listDiarios() {
  try {
    return fs.readdirSync(DIARIO_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();
  } catch { return []; }
}

/* Extrai as pendencias de um diario. O formato e consistente:
     ## Pendências pra amanhã (16/01)
     - **Follow-ups que vencem 16/01:** Empresa A (#000) e Empresa B (#001)
   Pegamos so os bullets de primeiro nivel da secao. */
function parseDiario(file) {
  const fileDate = file.slice(0, 10);
  const txt = fs.readFileSync(path.join(DIARIO_DIR, file), 'utf8');
  const lines = txt.split(/\r?\n/);
  const out = [];
  let inSection = false;
  let heading = '';

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const title = h[2];
      if (PENDING_RE.test(title)) { inSection = true; heading = title; }
      else if (inSection) { inSection = false; }  // proxima secao encerra
      continue;
    }
    if (!inSection) continue;
    if (!/^[-*]\s+\S/.test(line)) continue;       // so bullet de primeiro nivel
    const title = cleanTitle(line);
    if (!title || title.length < 4) continue;
    const client = detectClient(title);
    out.push({
      title,
      source: 'diario',
      dedupe_key: 'diario:' + fileDate + ':' + M.slug(title),
      due: dueFromHeading(heading, fileDate),
      origin: {
        label: 'Diário ' + fileDate.slice(8, 10) + '/' + fileDate.slice(5, 7),
        date: fileDate,
        ref: DIARY_REL + '/' + file,
        note_path: DIARY_REL + '/' + file,
        client,
      },
      related: client ? ['[[' + client + ']]'] : [],
      needs_review: false,
    });
  }
  return out;
}

/* Le os N diarios mais recentes. Default 2: o de ontem e o anterior, que e onde
   vive o que "sobrou". O merge no store cuida de nao duplicar entre eles. */
function collectDiario(days = 2) {
  const files = listDiarios().slice(0, Math.max(1, days));
  const items = [];
  for (const f of files) {
    try { items.push(...parseDiario(f)); }
    catch (e) { /* um diario torto nao pode derrubar a ingestao inteira */ }
  }
  return items;
}

/* Roda a sincronizacao completa das fontes locais e devolve o placar.
   Idempotente por construcao. Duas etapas, nesta ordem:
     1. absorve o que o usuario escreveu a mao na caixa de entrada do espelho
        (memory/todos.md), que e o caminho do Obsidian/celular pro painel;
     2. le as pendencias dos diarios recentes.
   Nenhuma das duas apaga ou sobrescreve tarefa existente. */
function run(opts = {}) {
  const days = Number(opts.days) || 2;

  let inbox = { absorbed: 0, added: 0, skipped: 0, kept: [] };
  try { inbox = M.absorbInbox(); }
  catch (e) { /* caixa de entrada torta nao pode travar a ingestao do diario */ }

  const candidates = collectDiario(days);
  const res = M.mergeIngested(candidates, inbox.kept || []);

  return {
    ok: true,
    scanned: candidates.length + (inbox.absorbed || 0),
    added: res.added + (inbox.added || 0),
    skipped: res.skipped + (inbox.skipped || 0),
    sources: { diario: candidates.length, caixa_de_entrada: inbox.absorbed || 0 },
    inbox_mantido: (inbox.kept || []).length,
    espelho: M.mirrorPath(),
    files: listDiarios().slice(0, days),
  };
}

module.exports = { run, collectDiario, parseDiario, listDiarios, detectClient };
