/* mission.js - estado do Mission Control (brief e store de to-dos).

   Regra de arquitetura: este modulo NUNCA fala com API externa e nunca guarda
   segredo. Quem tem credencial e um agente/cron externo, que reescreve
   state/mission.json. Aqui a gente le arquivo e, no caso dos to-dos, escreve
   com seguranca.

   Confiabilidade do store (as regras que o plano fixou):
     - dedupe_key obrigatoria em tudo que e ingerido
     - merge por dedupe_key (e por titulo normalizado) preservando status:
       tarefa concluida nunca ressuscita
     - escrita atomica: grava .tmp e renomeia
     - ingestao nunca apaga tarefa do usuario
*/
'use strict';
const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, 'state');
const MISSION_FILE = path.join(STATE_DIR, 'mission.json');
const TODOS_FILE = path.join(STATE_DIR, 'todos.json');

/* Espelho no Second Brain. O JSON continua sendo a fonte da verdade (estruturado,
   com status e dedupe); o markdown e regenerado a cada mudanca pra que o agente,
   numa sessao no vault, veja as tarefas na hora sem precisar do server no ar. */

let _cfg = null;
function cfg() {
  if (_cfg) return _cfg;
  try { _cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'workspace.json'), 'utf8')); }
  catch { _cfg = {}; }
  return _cfg;
}
function vaultRoot() {
  const r = cfg().root;
  if (!r) return null;
  return r === '~' || r.startsWith('~/') ? path.join(require('os').homedir(), r.slice(2)) : r; // aceita ~/
}

/* Convencoes do vault que o Mission Control precisa conhecer. Sao configuraveis
   em config/workspace.json -> missionControl, porque cada workspace nomeia suas
   pastas de um jeito. Os defaults abaixo sao so um chute razoavel. */
const MC_DEFAULTS = {
  diaryDir: 'memory/diario',
  clientsDir: 'clientes',
  mirrorPath: 'memory/todos.md',
  pendingHeadingPattern: 'pend[eê]ncias|pending',
  socialCalendar: 'Social/calendario.md', // tela Gestão, card Social
};
function mcOpt(key) {
  const mc = cfg().missionControl || {};
  return mc[key] || MC_DEFAULTS[key];
}
function mirrorRel() { return mcOpt('mirrorPath'); }
const INBOX_HEAD = '## Caixa de entrada';

const STATUSES = new Set(['open', 'doing', 'done', 'snoozed']);
const SOURCES = new Set(['manual', 'diario', 'memory', 'call', 'import']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

// ---------- basicos ----------
function nowISO() {
  // ISO com offset local, pra bater com o resto do OS (America/Sao_Paulo)
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
    + sign + pad(off / 60) + ':' + pad(off % 60);
}
function today() { return nowISO().slice(0, 10); }

function ensureDir() { fs.mkdirSync(STATE_DIR, { recursive: true }); }

function atomicWriteJSON(file, data) {
  ensureDir();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // rename e atomico no mesmo filesystem
}

function mtimeOf(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function slug(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
// chave de titulo: usada pra nao criar duas tarefas pra mesma coisa vinda de
// dias/fontes diferentes, e pra nao ressuscitar o que ja foi concluido
function titleKey(s) { return slug(s).slice(0, 48); }

function newId() {
  return 't_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

// ---------- mission.json (brief) ----------

function readMission() {
  const raw = readJSON(MISSION_FILE, null);
  if (!raw) {
    return {
      generated_at: null,
      missing: true,
      brief: { agenda: [], followups: [], emails: [], onde_parei: [] },
    };
  }
  return {
    generated_at: raw.generated_at || null,
    missing: false,
    brief: {
      agenda: (raw.brief && raw.brief.agenda) || [],
      followups: (raw.brief && raw.brief.followups) || [],
      emails: (raw.brief && raw.brief.emails) || [],
      onde_parei: (raw.brief && raw.brief.onde_parei) || [],
    },
  };
}

// ---------- store de to-dos ----------
function emptyStore() { return { version: 1, items: [], projects: [] }; }

function readStore() {
  const s = readJSON(TODOS_FILE, null);
  if (!s || !Array.isArray(s.items)) return emptyStore();
  // projects: os projetos da tela Tarefas (tecla T). Cada tarefa aponta para um pelo campo project.
  return { version: s.version || 1, items: s.items, projects: Array.isArray(s.projects) ? s.projects : [] };
}

/* mutate: read -> aplica -> write, com protecao contra escrita concorrente.
   Uma rotina externa pode estar escrevendo o arquivo no mesmo instante. Se o
   mtime mudou entre a leitura e a escrita, refazemos em cima do estado novo em
   vez de sobrescrever o trabalho do outro. */
function mutate(applyFn, opts = {}) {
  const attempts = opts.attempts || 4;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const before = mtimeOf(TODOS_FILE);
    const store = readStore();
    let out;
    try { out = applyFn(store); }
    catch (e) { lastErr = e; break; }
    if (mtimeOf(TODOS_FILE) !== before) continue; // alguem escreveu no meio, refaz
    atomicWriteJSON(TODOS_FILE, store);
    /* Reescreve o espelho no vault. Sem keepInbox explicito, preservamos o que
       estiver escrito a mao na caixa de entrada: uma acao no painel jamais pode
       apagar o que o usuario digitou no editor e ainda nao foi absorvido. */
    writeMirror(store, opts.keepInbox !== undefined ? opts.keepInbox : readInbox());
    return out;
  }
  throw lastErr || new Error('todos.json esta ocupado, tente de novo em um instante');
}

// ---------- espelho em markdown no Second Brain ----------
function laneOf(t, hoje) {
  if (t.status === 'done') return 'done';
  if (t.status === 'snoozed') return 'snoozed';
  if (!t.due) return 'noDate';
  if (t.due < hoje) return 'late';
  if (t.due === hoje) return 'today';
  return 'later';
}

function lineOf(t, projName) {
  const box = t.status === 'done' ? 'x' : ' ';
  const bits = [];
  if (projName) bits.push(projName);
  if (t.due) bits.push('vence ' + t.due.slice(8, 10) + '/' + t.due.slice(5, 7));
  if (t.origin && t.origin.label) bits.push('origem: ' + t.origin.label);
  if (t.origin && t.origin.client) bits.push('[[' + t.origin.client + ']]');
  if (t.needs_review) bits.push('conferir (extraída por IA)');
  if (t.status === 'snoozed' && t.snooze_until) bits.push('adiada até ' + t.snooze_until);
  return '- [' + box + '] ' + t.title + (bits.length ? ' · ' + bits.join(' · ') : '') + ' `' + t.id + '`';
}

function renderMirror(store, keepInbox) {
  const hoje = today();
  const lanes = { late: [], today: [], later: [], noDate: [], snoozed: [], done: [] };
  for (const t of store.items) lanes[laneOf(t, hoje)].push(t);
  const projNames = new Map((store.projects || []).map(p => [p.id, p.name]));
  const line = t => lineOf(t, t.project ? projNames.get(t.project) : '');

  const L = [];
  L.push('---');
  L.push('tipo: recurso');
  L.push('frente: operacao');
  L.push('gerado_em: ' + nowISO());
  L.push('---');
  L.push('');
  L.push('# To-dos');
  L.push('');
  L.push('> **Arquivo gerado pelo painel Mission Control.** Fonte da verdade:');
  L.push('> `state/todos.json` do app. As listas abaixo são reescritas a cada');
  L.push('> mudança no painel, então **editar uma linha aqui não tem efeito**.');
  L.push('>');
  L.push('> **Para adicionar tarefa por aqui** (Obsidian, celular, ou o próprio Claude):');
  L.push('> escreva na Caixa de entrada. A próxima sincronização absorve, dá id e move');
  L.push('> pra lista certa. Nada do que já está no painel é apagado nesse processo.');
  L.push('>');
  L.push('> Para mudar status de uma tarefa existente, use o id: veja as instruções em');
  L.push('> `.claude/skills/painel-ingestao-todos/SKILL.md`.');
  L.push('');
  L.push(INBOX_HEAD + ' (escreva aqui, o painel absorve)');
  L.push('');
  // o que o usuario escreveu e ainda nao foi absorvido volta intacto
  if (keepInbox && keepInbox.length) { for (const l of keepInbox) L.push(l); L.push(''); }

  const secs = [
    ['late', 'Atrasadas'], ['today', 'Hoje'], ['later', 'Próximas'],
    ['noDate', 'Sem prazo'], ['snoozed', 'Adiadas'],
  ];
  for (const [k, label] of secs) {
    if (!lanes[k].length) continue;
    L.push('## ' + label + ' (' + lanes[k].length + ')');
    L.push('');
    for (const t of lanes[k]) L.push(line(t));
    L.push('');
  }
  if (lanes.done.length) {
    const recentes = lanes.done
      .sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || '')))
      .slice(0, 20);
    L.push('## Concluídas (últimas ' + recentes.length + ')');
    L.push('');
    for (const t of recentes) L.push(line(t));
    L.push('');
  }
  const abertas = store.items.filter(t => t.status !== 'done').length;
  L.push('---');
  L.push('');
  L.push(abertas + ' em aberto · ' + lanes.done.length + ' concluída(s) · ' + store.items.length + ' no total.');
  L.push('');
  return L.join('\n');
}

function mirrorPath() {
  const root = vaultRoot();
  return root ? path.join(root, mirrorRel()) : null;
}

/* Le as linhas que estao na caixa de entrada do espelho e ainda nao viraram tarefa. */
function readInbox() {
  const p = mirrorPath();
  if (!p || !fs.existsSync(p)) return [];
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch { return []; }
  const lines = txt.split(/\r?\n/);
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (line.startsWith(INBOX_HEAD)) { inside = true; continue; }
    if (inside && /^##\s/.test(line)) break;
    if (!inside) continue;
    if (/^\s*$/.test(line)) continue;
    if (/^\s*<!--/.test(line)) continue;
    if (/^---\s*$/.test(line)) break;
    out.push(line);
  }
  return out;
}

function writeMirror(store, keepInbox) {
  const p = mirrorPath();
  if (!p) return null;
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, renderMirror(store || readStore(), keepInbox));
    fs.renameSync(tmp, p);
    return p;
  } catch (e) {
    // o espelho e conveniencia: se falhar, o painel nao pode cair por isso
    return null;
  }
}

/* Absorve o que foi escrito a mao na caixa de entrada. Linha que nao da pra
   entender FICA lá, nunca e apagada em silencio. */
function absorbInbox() {
  const raw = readInbox();
  if (!raw.length) return { absorbed: 0, kept: [], added: 0, skipped: 0 };
  const cands = [], kept = [];
  for (const line of raw) {
    const t = line.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, '').trim();
    if (t.length < 4) { kept.push(line); continue; }
    cands.push({
      title: t, source: 'manual',
      dedupe_key: 'inbox:' + slug(t),
      origin: { label: 'Escrita no brain', date: today(), ref: mirrorRel(), note_path: mirrorRel() },
    });
  }
  if (!cands.length) { writeMirror(null, kept); return { absorbed: 0, kept, added: 0, skipped: 0 }; }
  const res = mergeIngested(cands, kept);
  return { absorbed: cands.length, kept, added: res.added, skipped: res.skipped };
}

function normalizeItem(raw) {
  const t = String(raw.title || '').trim();
  if (!t) throw new Error('titulo obrigatorio');
  const status = STATUSES.has(raw.status) ? raw.status : 'open';
  const source = SOURCES.has(raw.source) ? raw.source : 'manual';
  const ts = nowISO();
  return {
    id: raw.id || newId(),
    dedupe_key: raw.dedupe_key || (source + ':' + slug(t) + ':' + Date.now().toString(36)),
    title: t.slice(0, 300),
    status,
    source,
    origin: {
      label: (raw.origin && raw.origin.label) || (source === 'manual' ? 'Adicionada por voce' : ''),
      date: (raw.origin && raw.origin.date) || today(),
      ref: (raw.origin && raw.origin.ref) || null,
      client: (raw.origin && raw.origin.client) || null,
      note_path: (raw.origin && raw.origin.note_path) || null,
    },
    related: Array.isArray(raw.related) ? raw.related : [],
    goal: raw.goal != null ? raw.goal : null,
    due: raw.due || null,
    project: raw.project || null,
    notes: raw.notes ? String(raw.notes).slice(0, 8000) : '',
    priority: PRIORITIES.has(raw.priority) ? raw.priority : 'medium',
    snooze_until: raw.snooze_until || null,
    needs_review: !!raw.needs_review,
    created_at: raw.created_at || ts,
    updated_at: ts,
    done_at: status === 'done' ? (raw.done_at || ts) : null,
  };
}

function addManual(payload) {
  return mutate(store => {
    if (payload.project && !(store.projects || []).some(p => p.id === payload.project)) throw new Error('projeto nao encontrado: ' + payload.project);
    const item = normalizeItem({ ...payload, source: 'manual', needs_review: false });
    store.items.push(item);
    return item;
  });
}

function updateTodo(id, patch) {
  return mutate(store => {
    const it = store.items.find(x => x.id === id);
    if (!it) throw new Error('tarefa nao encontrada: ' + id);
    if (patch.status !== undefined) {
      if (!STATUSES.has(patch.status)) throw new Error('status invalido: ' + patch.status);
      it.status = patch.status;
      it.done_at = patch.status === 'done' ? nowISO() : null;
      if (patch.status !== 'snoozed') it.snooze_until = null;
    }
    if (patch.title !== undefined) {
      const t = String(patch.title).trim();
      if (!t) throw new Error('titulo obrigatorio');
      it.title = t.slice(0, 300);
    }
    if (patch.due !== undefined) it.due = patch.due || null;
    if (patch.project !== undefined) {
      if (patch.project && !(store.projects || []).some(p => p.id === patch.project)) throw new Error('projeto nao encontrado: ' + patch.project);
      it.project = patch.project || null;
    }
    if (patch.notes !== undefined) it.notes = String(patch.notes || '').slice(0, 8000);
    if (patch.priority !== undefined) {
      if (!PRIORITIES.has(patch.priority)) throw new Error('prioridade invalida: ' + patch.priority);
      it.priority = patch.priority;
    }
    if (patch.snooze_until !== undefined) {
      it.snooze_until = patch.snooze_until || null;
      if (it.snooze_until) it.status = 'snoozed';
    }
    if (patch.needs_review !== undefined) it.needs_review = !!patch.needs_review;
    if (patch.goal !== undefined) it.goal = patch.goal;
    it.updated_at = nowISO();
    return it;
  });
}

function deleteTodo(id) {
  return mutate(store => {
    const i = store.items.findIndex(x => x.id === id);
    if (i < 0) throw new Error('tarefa nao encontrada: ' + id);
    const [gone] = store.items.splice(i, 1);
    return gone;
  });
}

// ---------- projetos (tela Tarefas, tecla T) ----------
const PROJ_CORES = ['#808AFF', '#43C07A', '#FF6B2C', '#E5533D', '#E0B341', '#3FB6D3', '#C77DFF', '#8A93A6'];
function projName(raw) {
  const n = String(raw || '').trim().slice(0, 80);
  if (!n) throw new Error('nome do projeto obrigatorio');
  return n;
}
function addProject(payload) {
  return mutate(store => {
    const name = projName(payload && payload.name);
    if (store.projects.some(p => slug(p.name) === slug(name))) throw new Error('ja existe um projeto com esse nome');
    const proj = {
      id: 'p_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3),
      name, color: (payload && payload.color) || PROJ_CORES[store.projects.length % PROJ_CORES.length],
      archived: false, created_at: nowISO(),
    };
    store.projects.push(proj);
    return proj;
  });
}
function updateProject(id, patch) {
  return mutate(store => {
    const p = store.projects.find(x => x.id === id);
    if (!p) throw new Error('projeto nao encontrado: ' + id);
    if (patch.name !== undefined) {
      const name = projName(patch.name);
      if (store.projects.some(x => x.id !== id && slug(x.name) === slug(name))) throw new Error('ja existe um projeto com esse nome');
      p.name = name;
    }
    if (patch.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(patch.color)) p.color = patch.color;
    if (patch.archived !== undefined) p.archived = !!patch.archived;
    return p;
  });
}
/* Apagar projeto nunca apaga tarefa: as dele ficam sem projeto. */
function deleteProject(id) {
  return mutate(store => {
    const i = store.projects.findIndex(x => x.id === id);
    if (i < 0) throw new Error('projeto nao encontrado: ' + id);
    const [gone] = store.projects.splice(i, 1);
    let soltas = 0;
    for (const t of store.items) if (t.project === id) { t.project = null; t.updated_at = nowISO(); soltas++; }
    return { ...gone, soltas };
  });
}

/* importTasks: traz projetos e tarefas de outro sistema, uma vez ou varias (idempotente).
   Projeto casa pelo nome; tarefa casa pela dedupe_key. Diferente do mergeIngested, titulo
   repetido em projetos diferentes entra, e o status de origem (inclusive concluida) vale.
   Tarefa que ja esta aqui nunca e alterada.
   payload: { projects: [{ key, name }], tasks: [{ dedupe_key, title, project_key, status, due, notes, priority, created_at, done_at, origin }] } */
function importTasks(payload) {
  return mutate(store => {
    const byName = new Map(store.projects.map(p => [slug(p.name), p]));
    const keyToId = new Map();
    let projetos = 0;
    for (const p of (payload.projects || [])) {
      const name = projName(p.name);
      let alvo = byName.get(slug(name));
      if (!alvo) {
        alvo = { id: 'p_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3), name,
          color: PROJ_CORES[store.projects.length % PROJ_CORES.length], archived: false, created_at: nowISO() };
        store.projects.push(alvo); byName.set(slug(name), alvo); projetos++;
      }
      keyToId.set(String(p.key), alvo.id);
    }
    const byKey = new Set(store.items.map(i => i.dedupe_key));
    let added = 0, skipped = 0;
    for (const c of (payload.tasks || [])) {
      if (!c || !c.title || !c.dedupe_key || byKey.has(c.dedupe_key)) { skipped++; continue; }
      const item = normalizeItem({ ...c, id: undefined, source: 'import', needs_review: false,
        project: c.project_key != null ? (keyToId.get(String(c.project_key)) || null) : null });
      store.items.push(item); byKey.add(item.dedupe_key); added++;
    }
    return { projetos, added, skipped };
  });
}

/* mergeIngested: o coracao da confiabilidade.
   Insere apenas o que e novo. Nunca toca no status do que ja existe, nunca
   remove nada, e nunca recria algo que o usuario ja concluiu (checagem por
   titulo normalizado, que pega a mesma pendencia repetida em dias diferentes). */
function mergeIngested(candidates, keepInbox) {
  return mutate(store => {
    const byKey = new Set(store.items.map(i => i.dedupe_key));
    const byTitle = new Set(store.items.map(i => titleKey(i.title)));
    const added = [];
    const skipped = [];
    for (const c of candidates) {
      if (!c || !c.title || !c.dedupe_key) continue;
      if (byKey.has(c.dedupe_key)) { skipped.push({ title: c.title, why: 'dedupe_key' }); continue; }
      if (byTitle.has(titleKey(c.title))) { skipped.push({ title: c.title, why: 'titulo-ja-existe' }); continue; }
      const item = normalizeItem(c);
      store.items.push(item);
      byKey.add(item.dedupe_key);
      byTitle.add(titleKey(item.title));
      added.push(item);
    }
    return { added: added.length, skipped: skipped.length, addedItems: added, skippedItems: skipped };
  }, { keepInbox });
}

/* Tarefas adiadas cujo prazo chegou voltam para 'open' sozinhas. */
function wakeSnoozed() {
  const store = readStore();
  const t = today();
  const due = store.items.filter(i => i.status === 'snoozed' && i.snooze_until && i.snooze_until <= t);
  if (!due.length) return 0;
  return mutate(s => {
    let n = 0;
    for (const it of s.items) {
      if (it.status === 'snoozed' && it.snooze_until && it.snooze_until <= t) {
        it.status = 'open'; it.snooze_until = null; it.updated_at = nowISO(); n++;
      }
    }
    return n;
  });
}

module.exports = {
  STATE_DIR, MISSION_FILE, TODOS_FILE, mirrorRel, mcOpt, vaultRoot,
  nowISO, today, slug, titleKey, atomicWriteJSON,
  readMission, readStore, addManual, updateTodo, deleteTodo, mergeIngested, wakeSnoozed,
  writeMirror, readInbox, absorbInbox, mirrorPath, renderMirror,
  addProject, updateProject, deleteProject, importTasks,
};
