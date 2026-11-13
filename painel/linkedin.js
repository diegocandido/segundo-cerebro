/* linkedin.js - a tela LinkedIn do painel (tecla I), só leitura.

   O LinkedIn está conectado no Zernio, a mesma conta do Estúdio de Conteúdo. A chave é lida do
   Estúdio (missionControl.estudioApp, padrão ~/estudio-conteudo/app, arquivo dados/config.json,
   campo "chave") e nunca sai deste servidor. Aqui só GET: conta, posts e números. Publicar e
   agendar continuam pelo Claude (bin/linkedin.py do OS), com prévia e confirmação. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const M = require('./mission');

const BASE = 'https://zernio.com/api';
const ROTAS = new Set(['/v1/accounts', '/v1/posts', '/v1/analytics']);

function chave() {
  const raw = M.mcOpt('estudioApp') || '~/estudio-conteudo/app';
  const app = raw.startsWith('~/') ? path.join(os.homedir(), raw.slice(2)) : raw;
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(app, 'dados', 'config.json'), 'utf8')); }
  catch { throw new Error('Estúdio de Conteúdo não encontrado: o LinkedIn usa a chave do Zernio gravada nele.'); }
  if (!/^sk_/.test(cfg.chave || '')) throw new Error('O Estúdio está sem a chave do Zernio (Ajustes → Contas).');
  return cfg.chave;
}

async function zernio(caminho, params) {
  if (!ROTAS.has(caminho)) throw new Error('recusado: ' + caminho);
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await fetch(BASE + caminho + q, {
    headers: { Authorization: 'Bearer ' + chave(), Accept: 'application/json', 'User-Agent': 'os-linkedin' },
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Zernio: ' + (j.error || j.message || 'HTTP ' + r.status));
  return j;
}

async function resumo() {
  const desde = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const [contas, lista, numeros] = await Promise.all([
    zernio('/v1/accounts'),
    zernio('/v1/posts', { platform: 'linkedin', limit: '50' }),
    zernio('/v1/analytics', { platform: 'linkedin', fromDate: desde, limit: '100', sortBy: 'date', order: 'desc' }).catch(() => ({ posts: [] })),
  ]);
  const c = (contas.accounts || []).find(a => a.platform === 'linkedin');
  if (!c) throw new Error('Nenhum LinkedIn conectado no Zernio.');
  const metricas = new Map();
  for (const p of numeros.posts || []) metricas.set(p._id || p.postId || p.id, p.analytics || p);
  const posts = (lista.posts || []).map(p => {
    const m = metricas.get(p._id) || {};
    const plat = (p.platforms || []).find(x => x.platform === 'linkedin') || {};
    return {
      id: p._id, status: p.status, texto: (p.content || '').slice(0, 600),
      quando: p.scheduledFor || p.publishedAt || p.createdAt || '', publicadoEm: p.publishedAt || '',
      url: plat.platformPostUrl || '', erro: plat.errorMessage || p.errorMessage || '',
      midia: (p.mediaItems || []).map(x => x.type)[0] || 'texto',
      impressoes: m.impressions || 0, curtidas: m.likes || 0, comentarios: m.comments || 0,
      compartilhamentos: m.shares || 0, cliques: m.clicks || 0,
    };
  });
  const agora = Date.now();
  const pub = posts.filter(p => p.status === 'published');
  const ult30 = pub.filter(p => agora - Date.parse(p.publicadoEm || p.quando) <= 30 * 864e5);
  return {
    conta: {
      nome: c.displayName || c.username, perfil: c.profileUrl || '', foto: c.profilePicture || '',
      seguidores: c.followersCount || 0, ativa: !!c.isActive && !c.needsReconnection,
      vence: String(c.tokenExpiresAt || '').slice(0, 10),
    },
    agendados: posts.filter(p => p.status === 'scheduled').sort((a, b) => a.quando.localeCompare(b.quando)),
    publicados: pub.sort((a, b) => (b.publicadoEm || b.quando).localeCompare(a.publicadoEm || a.quando)),
    falhas: posts.filter(p => p.status === 'failed'),
    trinta: {
      posts: ult30.length,
      impressoes: ult30.reduce((s, p) => s + p.impressoes, 0),
      reacoes: ult30.reduce((s, p) => s + p.curtidas + p.comentarios + p.compartilhamentos, 0),
    },
  };
}

module.exports = { resumo };
