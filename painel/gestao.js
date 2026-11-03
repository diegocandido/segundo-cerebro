/* gestao.js - os números da tela Gestão (tecla G), todos só leitura.

   Cada bloco vem de uma fonte e falha sozinho: se o Asaas cair, o resto aparece.
     - cobrancas: Asaas (asaas.js, mesma leitura da tecla C)
     - propostas: registros em {vault}/{missionControl.propostasDir}/*.md (padrão inbox/propostas)
     - whatsapp:  Uazapi, só GET /instance/status, POST /chat/find e POST /message/find
     - tarefas e agenda/e-mails: o que o Mission Control já guarda (state/)
     - clientes:  pastas de {vault}/Clientes e notas de Clientes/_prospects
     - social:    tabelas do calendário editorial (missionControl.socialCalendar, padrão Social/calendario.md)

   Nada aqui envia, cria ou altera algo fora deste computador. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const scan = require('./scan');
const M = require('./mission');
const asaas = require('./asaas');

const ROOT = scan.ROOT;
// pasta dos registros de proposta (pedidos e enviadas): workspace.json -> missionControl.propostasDir
const PROPOSTAS_DIR = path.join(ROOT, M.mcOpt('propostasDir') || 'inbox/propostas');
const CLIENTES_DIR = path.join(ROOT, M.mcOpt('clientsDir'));

// ---------- frontmatter mínimo (chaves simples, uma por linha) ----------
function frontmatter(txt) {
  const m = txt.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  for (const linha of m[1].split(/\r?\n/)) {
    const mm = linha.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (mm) out[mm[1]] = mm[2].trim();
  }
  return out;
}
function secao(txt, titulo) {
  const i = txt.indexOf('## ' + titulo);
  if (i < 0) return '';
  const resto = txt.slice(i + titulo.length + 3);
  const fim = resto.search(/\n## /);
  return (fim < 0 ? resto : resto.slice(0, fim)).trim();
}
const diasDesde = d => {
  const t = Date.parse(String(d || '').slice(0, 10) + 'T12:00:00');
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 864e5) : null;
};

// ---------- propostas ----------
function propostas() {
  let arqs = [];
  try { arqs = fs.readdirSync(PROPOSTAS_DIR).filter(f => f.endsWith('.md')); } catch { return { pendentes: [], enviadas: [], descartadas: 0 }; }
  const itens = [];
  for (const f of arqs) {
    let txt; try { txt = fs.readFileSync(path.join(PROPOSTAS_DIR, f), 'utf8'); } catch { continue; }
    const fm = frontmatter(txt);
    if (fm.tipo !== 'pedido-proposta') continue;
    itens.push({
      arquivoNota: path.relative(ROOT, path.join(PROPOSTAS_DIR, f)).split(path.sep).join('/'),
      status: fm.status || 'pendente', cliente: fm.cliente || '(sem cliente)', whatsapp: fm.whatsapp || '',
      pdf: fm.arquivo || '', pedidoEm: fm.pedido_em || '', enviadoEm: fm.enviado_em || '',
      origem: fm.origem || 'hermes', mensagem: secao(txt, 'Mensagem').slice(0, 400),
      rascunho: !fm.arquivo && !!secao(txt, 'Rascunho da proposta'),
    });
  }
  const pendentes = itens.filter(i => i.status === 'pendente')
    .map(i => ({ ...i, parado: (diasDesde(i.pedidoEm) || 0) > 2 }))
    .sort((a, b) => a.pedidoEm.localeCompare(b.pedidoEm));
  const enviadas = itens.filter(i => i.status === 'enviada').sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
  const mes = M.today().slice(0, 7);
  return {
    pendentes, enviadas: enviadas.slice(0, 30),
    enviadasNoMes: enviadas.filter(i => i.enviadoEm.startsWith(mes)).length,
    enviadas30d: enviadas.filter(i => { const d = diasDesde(i.enviadoEm); return d !== null && d <= 30; }).length,
    descartadas: itens.filter(i => i.status === 'descartado').length,
  };
}

// ---------- clientes ----------
function clientes() {
  const ativos = [], prospects = [];
  let dirs = [];
  try { dirs = fs.readdirSync(CLIENTES_DIR, { withFileTypes: true }); } catch { return { ativos, prospects }; }
  for (const d of dirs) {
    if (!d.isDirectory() || d.name.startsWith('_') || d.name.startsWith('.')) continue;
    const rel = path.join(M.mcOpt('clientsDir'), d.name, 'estado.md').split(path.sep).join('/');
    let fm = {};
    try { fm = frontmatter(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { }
    const at = fm.atualizado || '';
    ativos.push({ nome: d.name, resumo: fm.resumo || '', atualizado: at, velho: (diasDesde(at) || 0) > 14, nota: rel });
  }
  try {
    for (const f of fs.readdirSync(path.join(CLIENTES_DIR, '_prospects')).filter(f => f.endsWith('.md'))) {
      const rel = path.join(M.mcOpt('clientsDir'), '_prospects', f).split(path.sep).join('/');
      const fm = frontmatter(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      prospects.push({ nome: fm.cliente || f.replace(/\.md$/, ''), resumo: fm.resumo || '', nota: rel });
    }
  } catch { }
  ativos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { ativos, prospects };
}

// ---------- social: o calendário editorial (fila e publicados) ----------
// Precisa de duas tabelas no calendário: "## Próximos posts" (Data | Rede 1 | Rede 2 | Status) e
// "## Publicados" (Data | Rede | Peça | Link). Linha riscada (~~) em Publicados conta como post para apagar.
function tabela(txt, titulo) {
  const linhas = secao(txt, titulo).split(/\r?\n/).filter(l => /^\|/.test(l.trim()));
  return linhas.slice(2).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
}
const semMd = s => String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/~~/g, '').replace(/\*\(?|\)?\*/g, '').replace(/`/g, '').trim();
const isoBr = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
function social() {
  const rel = M.mcOpt('socialCalendar');
  const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const publicados = tabela(txt, 'Publicados').map(([data, rede, peca, link]) => {
    const url = (String(link || '').match(/\((https?:[^)\s]+)\)/) || [])[1] || '';
    const riscado = /~~/.test(peca || '');
    return { data: isoBr(data), rede: semMd(rede), peca: semMd(String(peca || '').split('~~').filter(Boolean)[0]),
      nota: riscado ? semMd(String(peca).split('~~').pop()) : '', url, ativo: !riscado };
  }).sort((a, b) => b.data.localeCompare(a.data));
  const fila = tabela(txt, (txt.match(/^## (Próxim[^\n]*)/m) || [])[1] || 'Próximos posts').map(([data, rede1, rede2, status]) => ({
    data: isoBr(data), linkedin: semMd(rede1), instagram: semMd(rede2), status: semMd(status),
  })).filter(f => /pronto|aguardando/i.test(f.status) || (/pautar|rascunho|gravar/i.test(f.status) && f.data >= M.today()));
  const ativos = publicados.filter(p => p.ativo);
  return {
    nota: rel, publicados, fila,
    publicados30d: ativos.filter(p => { const d = diasDesde(p.data); return d !== null && d <= 30; }).length,
    paraApagar: publicados.filter(p => !p.ativo).length,
    esperando: fila.filter(f => /pronto|aguardando/i.test(f.status)).length,
  };
}

// ---------- tarefas e Morning Brief (o que o Mission Control já tem) ----------
function tarefas() {
  const store = M.readStore();
  const lista = (store.todos || store.items || []);
  const abertas = lista.filter(t => t.status !== 'done');
  const hoje = M.today();
  return {
    abertas: abertas.length,
    atrasadas: abertas.filter(t => t.due && t.due < hoje && t.status !== 'snoozed').length,
    paraHoje: abertas.filter(t => t.due === hoje).length,
  };
}
function brief() {
  const m = M.readMission();
  return { geradoEm: m.generated_at, agenda: m.brief.agenda || [], emails: m.brief.emails || [], followups: m.brief.followups || [] };
}

// ---------- WhatsApp (Uazapi), só leitura ----------
const UAZAPI_ENV = path.join(os.homedir(), '.uazapi.env');
const UAZAPI_ROTAS = new Set(['GET /instance/status', 'POST /chat/find', 'POST /message/find']);
function uazapiCfg() {
  let txt = '';
  try { txt = fs.readFileSync(UAZAPI_ENV, 'utf8'); } catch { return null; }
  const v = {};
  for (const l of txt.split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0) v[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  if (!/^https:\/\/[A-Za-z0-9.-]+$/.test(v.UAZAPI_URL || '') || !v.UAZAPI_TOKEN) return null;
  return { url: v.UAZAPI_URL, token: v.UAZAPI_TOKEN };
}
async function uazapi(metodo, caminho, corpo) {
  if (!UAZAPI_ROTAS.has(metodo + ' ' + caminho)) throw new Error('recusado: ' + metodo + ' ' + caminho);
  const c = uazapiCfg();
  if (!c) throw new Error('WhatsApp não configurado (~/.uazapi.env)');
  const r = await fetch(c.url + caminho, {
    method: metodo, signal: AbortSignal.timeout(15000),
    headers: { token: c.token, accept: 'application/json', 'content-type': 'application/json', 'User-Agent': 'os-gestao' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Uazapi: ' + (j.message || j.error || 'HTTP ' + r.status));
  return j;
}
const tsMs = t => { const n = Number(t) || 0; return n > 1e12 ? n : n * 1000; };
async function whatsapp() {
  const st = await uazapi('GET', '/instance/status');
  const conectado = !!(st.status && st.status.connected);
  const j = await uazapi('POST', '/chat/find', { sort: '-wa_lastMsgTimestamp', limit: 30, offset: 0, compact: true, wa_isGroup: false });
  const conversas = (j.chats || []).map(c => ({
    nome: c.wa_contactName || c.name || c.wa_name || '',
    numero: String(c.phone || '').replace(/\D/g, '') || String(c.wa_chatid || '').split('@')[0],
    chatid: c.wa_chatid || '', naoLidas: Number(c.wa_unreadCount) || 0, ultima: tsMs(c.wa_lastMsgTimestamp),
  }));
  return { conectado, perfil: (st.instance || {}).profileName || '', naoLidas: conversas.filter(c => c.naoLidas > 0).length, conversas };
}
async function whatsappMensagens(chatid) {
  if (!/^[0-9]{8,20}@(s\.whatsapp\.net|lid)$/.test(chatid || '')) throw new Error('conversa inválida');
  const j = await uazapi('POST', '/message/find', { chatid, limit: 30, offset: 0 });
  return (j.messages || []).reverse().map(m => ({
    eu: !!m.fromMe, quem: m.fromMe ? 'Eu' : (m.senderName || 'Contato'),
    texto: (m.text || '').slice(0, 2000) || '[' + (m.messageType || 'mídia') + ']', quando: tsMs(m.messageTimestamp),
  }));
}

// ---------- tudo junto ----------
async function bloco(fn) {
  try { return { ok: true, ...(await fn()) }; } catch (e) { return { ok: false, erro: e.message }; }
}
async function resumo() {
  const [cobrancas, wpp] = await Promise.all([bloco(asaas.listarCobrancas), bloco(whatsapp)]);
  return {
    geradoEm: M.nowISO(),
    cobrancas, whatsapp: wpp,
    propostas: await bloco(async () => propostas()),
    clientes: await bloco(async () => clientes()),
    social: await bloco(async () => social()),
    tarefas: await bloco(async () => tarefas()),
    brief: await bloco(async () => brief()),
  };
}

module.exports = { resumo, whatsappMensagens };
