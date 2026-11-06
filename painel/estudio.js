/* estudio.js: o Estúdio Social do painel (tecla E). Só leitura.

   Mostra cada peça de rede social que está sendo feita (carrossel, card) como um cartão com a capa,
   na etapa em que ela está: em criação, para aprovar, aprovada, publicada. É lido das pastas das
   peças, então o painel vê o trabalho acontecendo enquanto o Claude gera.

   Onde procura: config/workspace.json -> missionControl.carrosseisDirs (lista; caminho relativo ao
   segundo cérebro, absoluto ou com ~). Padrão: Social/carrosseis e ~/.carrossel-vivo/projetos.
   Cada subpasta é uma peça. Entende dois formatos:
     - projeto da skill criador-de-carrosseis-simples: BRIEF.md, resultados/estatico/slide-NN.png,
       resultados/slide-NN.mp4 (vivo), legenda.txt
     - carrossel do modelo do kit: slide-NN.html, jpeg/*.jpg, mp4/*.mp4, legenda.txt
   A etapa vem do arquivo status.txt da peça, se existir (linhas "etapa: aprovado",
   "data: 2026-11-07", "rede: Instagram", "link: https://...", "titulo: ..."); "etapa: descartado" (ou arquivado) tira a peça do quadro; sem ele, é deduzida dos arquivos.
   Peça cuja legenda.txt bate com um post do histórico do bin/instagram.py
   (missionControl.publicadosLog, padrão Social/publicados-instagram.jsonl) vira Publicado sozinha,
   com o link e a data do post. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const scan = require('./scan');
const M = require('./mission');

const ROOT = scan.ROOT;
const PADRAO = ['Social/carrosseis', '~/.carrossel-vivo/projetos'];
const IMG = /\.(png|jpe?g|webp)$/i;
const VID = /\.mp4$/i;
const ETAPAS = ['criando', 'aprovar', 'aprovado', 'publicado'];
const NOMES = { criando: 'Em criação', aprovar: 'Para aprovar', aprovado: 'Aprovado', publicado: 'Publicado' };

function dirs() {
  let lista = M.mcOpt('carrosseisDirs');
  if (!Array.isArray(lista) || !lista.length) lista = PADRAO;
  return lista.map(d => {
    const e = scan.expandHome(String(d));
    return { rel: d, abs: path.isAbsolute(e) ? e : path.join(ROOT, e) };
  });
}

// histórico do bin/instagram.py: uma linha JSON por post, com a assinatura da legenda
function publicados() {
  const rel = M.mcOpt('publicadosLog') || 'Social/publicados-instagram.jsonl';
  const e = scan.expandHome(String(rel));
  const out = new Map();
  let txt = '';
  try { txt = fs.readFileSync(path.isAbsolute(e) ? e : path.join(ROOT, e), 'utf8'); } catch { return out; }
  for (const l of txt.split(/\r?\n/)) {
    try { const j = JSON.parse(l); if (j.assinatura) out.set(j.assinatura, j); } catch { }
  }
  return out;
}
// a mesma conta do instagram.py: sha256 da legenda com os espaços normalizados, 16 primeiros caracteres
const assinatura = t => crypto.createHash('sha256').update(String(t).split(/\s+/).filter(Boolean).join(' '), 'utf8').digest('hex').slice(0, 16);

function listar(dir, re) {
  try { return fs.readdirSync(dir).filter(f => re.test(f) && !f.startsWith('.')).sort(); } catch { return []; }
}
function mtime(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }
function ler(p, max) { try { return fs.readFileSync(p, 'utf8').slice(0, max || 4000); } catch { return ''; } }

function status(pasta) {
  const out = {};
  for (const l of ler(path.join(pasta, 'status.txt')).split(/\r?\n/)) {
    const m = l.match(/^\s*([a-zçã]+)\s*:\s*(.+?)\s*$/i);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

function titulo(pasta, nome) {
  const brief = ler(path.join(pasta, 'BRIEF.md'));
  const tema = brief.match(/^[ \t]*(?:[-*][ \t]*)?\**(?:tema|frase única|frase unica)\**[ \t]*[:·]\**[ \t]*([^\s*].*)$/im);
  if (tema && !/preencher|\{\{|^\[/.test(tema[1].trim())) return tema[1].replace(/[*_`]/g, '').trim().slice(0, 120);
  const h = brief.match(/^#[ \t]+(.+)$/m);
  if (h && !/^BRIEF\b/i.test(h[1].trim())) return h[1].replace(/[*_`]/g, '').trim().slice(0, 120);
  const resto = nome.replace(/^\d{4}-\d{2}-\d{2}[-_ ]*/, '');
  if (!resto || /^[0-9a-f]{5,8}$/i.test(resto)) { // pasta com nome de data e código: usa a 1ª frase da legenda
    const leg = ler(path.join(pasta, 'legenda.txt'), 400).split(/\r?\n/).find(l => l.trim());
    if (leg) return leg.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').split(/(?<=[.!?])\s/)[0].trim().slice(0, 110);
  }
  const dt = nome.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dt && (!resto || /^[0-9a-f]{5,8}$/i.test(resto))) return 'Carrossel de ' + dt[3] + '/' + dt[2] + (resto ? ' (' + resto + ')' : '');
  const limpo = resto.replace(/[-_]+/g, ' ').trim() || nome;
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

// arquivos de mídia da peça, relativos à pasta dela
function midia(pasta) {
  const imgs = [];
  for (const sub of ['resultados/estatico', 'jpeg', 'png', 'imagens-prontas']) {
    const todas = listar(path.join(pasta, sub), IMG);
    const slides = todas.filter(f => /^(slide|card)/i.test(f)); // folha e miniatura de prova ficam de fora
    for (const f of (slides.length ? slides : todas)) imgs.push(sub + '/' + f);
    if (imgs.length) break;
  }
  if (!imgs.length) for (const f of listar(pasta, IMG)) if (/^(slide|card)/i.test(f)) imgs.push(f);
  const vids = [];
  for (const sub of ['resultados', 'mp4']) {
    for (const f of listar(path.join(pasta, sub), VID)) vids.push(sub + '/' + f);
    if (vids.length) break;
  }
  const folha = ['folha.png', 'resultados/folha.png'].find(f => fs.existsSync(path.join(pasta, f))) || '';
  return { imgs, vids, folha };
}

function ehPeca(pasta) {
  return ['BRIEF.md', 'status.txt', 'legenda.txt', 'slide-01.html', 'src/slides', 'resultados', 'jpeg'].some(f => fs.existsSync(path.join(pasta, f)))
    || listar(pasta, /^(slide|card)[-_]?\d*.*\.(png|jpe?g|webp)$/i).length > 0;
}

// "2026-11-07", "07/11/2026" ou "07/11" -> "2026-11-07" (as abas Semana e Feed usam); o resto fica vazio
function dataISO(t) {
  const s = String(t || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return '';
  let a = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (a < 100) a += 2000;
  return a + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
}

function peca(base, i, nome, hist) {
  const pasta = path.join(base.abs, nome);
  const st = status(pasta);
  const legenda = ler(path.join(pasta, 'legenda.txt'), 2200).trim();
  const post = legenda && hist ? hist.get(assinatura(legenda)) : null;
  if (post && !st.etapa) { st.etapa = 'publicado'; st.link = st.link || post.link || ''; st.data = st.data || post.data || ''; st.rede = st.rede || 'Instagram'; }
  const m = midia(pasta);
  let etapa = (st.etapa || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/publicad|postad/.test(etapa)) etapa = 'publicado';
  else if (/^aprovad/.test(etapa)) etapa = 'aprovado';
  else if (/aprovar|revis/.test(etapa)) etapa = 'aprovar';
  else if (/cria|rascunho|copy|design/.test(etapa)) etapa = 'criando';
  else etapa = m.imgs.length ? 'aprovar' : 'criando';
  // o que mudou por último na pasta (até 2 níveis): mostra o que está sendo feito agora
  let atualizado = 0;
  for (const sub of ['', 'src/slides', 'resultados', 'resultados/estatico', 'jpeg', 'mp4', 'docs']) {
    const d = path.join(pasta, sub);
    for (const f of listar(d, /./)) {
      const a = path.join(d, f);
      try { if (fs.statSync(a).isFile()) atualizado = Math.max(atualizado, fs.statSync(a).mtimeMs); } catch { }
    }
  }
  if (!atualizado) atualizado = mtime(pasta);
  const slidesHtml = listar(path.join(pasta, 'src/slides'), /^slide-\d+\.html$/).length || listar(pasta, /^slide-\d+\.html$/).length;
  return {
    id: i + ':' + nome, nome, titulo: st.titulo || (post && post.titulo) || titulo(pasta, nome), etapa, etapaNome: NOMES[etapa],
    rede: st.rede || '', data: st.data || '', dataISO: dataISO(st.data), link: /^https?:\/\//.test(st.link || '') ? st.link : '',
    capa: m.imgs[0] || m.folha || '', imgs: m.imgs, vids: m.vids, slidesHtml,
    legenda,
    temBrief: fs.existsSync(path.join(pasta, 'BRIEF.md')),
    atualizado, agora: etapa !== 'publicado' && Date.now() - atualizado < 10 * 60 * 1000,
    onde: path.join(base.rel, nome),
  };
}

function resumo() {
  const pecas = [];
  const fontes = [];
  const hist = publicados();
  dirs().forEach((base, i) => {
    let nomes = [];
    try { nomes = fs.readdirSync(base.abs, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name); }
    catch { fontes.push({ pasta: base.rel, existe: false }); return; }
    fontes.push({ pasta: base.rel, existe: true });
    for (const n of nomes) {
      const p = path.join(base.abs, n);
      if (/descart|arquiv/i.test(status(p).etapa || '')) continue; // "etapa: descartado" tira a peça do quadro
      if (ehPeca(p)) pecas.push(peca(base, i, n, hist));
    }
  });
  pecas.sort((a, b) => b.atualizado - a.atualizado);
  const contagem = Object.fromEntries(ETAPAS.map(e => [e, pecas.filter(p => p.etapa === e).length]));
  // perfil da prévia (abas Posts e Feed) e o dia fixo de postar (aba Semana, 1 = segunda ... 6 = sábado):
  // vêm do workspace.json (missionControl.estudioConta e estudioDiaPost), não do código
  const dia = Number(M.mcOpt('estudioDiaPost'));
  const perfil = { conta: String(M.mcOpt('estudioConta') || '').replace(/^@/, ''), diaPost: Number.isInteger(dia) && dia >= 1 && dia <= 6 ? dia : null };
  return { geradoEm: M.nowISO(), perfil, fontes, etapas: ETAPAS.map(e => ({ id: e, nome: NOMES[e] })), contagem, pecas };
}

// caminho de um arquivo de mídia, só se ele for uma das mídias listadas daquela peça
function arquivo(id, rel) {
  const m = String(id || '').match(/^(\d+):([^/\\]+)$/);
  if (!m || !rel || /\.\./.test(rel)) return null;
  const base = dirs()[Number(m[1])];
  if (!base) return null;
  const pasta = path.join(base.abs, m[2]);
  const md = midia(pasta);
  if (![...md.imgs, ...md.vids, md.folha].includes(rel)) return null;
  const abs = path.join(pasta, rel);
  return abs.startsWith(pasta + path.sep) && fs.existsSync(abs) ? abs : null;
}

module.exports = { resumo, arquivo };
