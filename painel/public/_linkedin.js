/* _linkedin.js - tela LinkedIn (tecla I): a conta, os posts agendados e publicados e os números.

   Um fetch em /api/linkedin (só leitura, pelo Zernio). Publicar e agendar continuam pelo Claude
   ("publica esse post no LinkedIn"), que mostra a prévia e só publica depois do sim. */
'use strict';
(function () {
  let dados = null, erro = '', carregando = false;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = n => Number(n || 0).toLocaleString('pt-BR');
  const quando = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  function linha(p, publicado) {
    const primeira = esc((p.texto || '').split('\n').find(l => l.trim()) || '(sem texto)');
    const metr = publicado
      ? '<span>' + num(p.impressoes) + ' impressões</span><span>' + num(p.curtidas) + ' curtidas</span><span>' + num(p.comentarios) + ' comentários</span><span>' + num(p.compartilhamentos) + ' compart.</span><span>' + num(p.cliques) + ' cliques</span>'
      : '<span>' + esc(p.midia === 'document' ? 'PDF em carrossel' : p.midia === 'image' ? 'com imagem' : p.midia === 'video' ? 'vídeo' : 'só texto') + '</span>';
    return '<div class="mc-row li-post"><div class="mc-row-time' + (p.erro ? ' late' : '') + '">' + esc(quando(publicado ? (p.publicadoEm || p.quando) : p.quando)) + '</div>'
      + '<div class="mc-row-main"><div class="mc-row-t">' + primeira + '</div><div class="li-metr">' + metr
      + (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">abrir no LinkedIn ↗</a>' : '')
      + (p.erro ? '<b class="gs-alerta">' + esc(p.erro) + '</b>' : '') + '</div></div></div>';
  }

  function render() {
    const inner = $('#li-inner');
    if (!inner) return;
    const B = window.BRAND || {};
    inner.innerHTML = '';
    const top = el('div', 'mc-top');
    const back = el('button', 'mc-back', '<span class="mc-back-arrow">&#9666;</span><div><div><span class="mc-back-name">' + esc(B.nome || 'Cara da IA')
      + '</span><span class="mc-back-os">LinkedIn</span></div><div class="mc-back-sub">voltar pro grafo do cérebro</div></div>');
    back.onclick = fechar;
    top.appendChild(back);
    const dir = el('div', 'mc-top-right');
    const bAt = el('button', 'act', carregando ? 'Atualizando...' : 'Atualizar');
    bAt.onclick = carregar;
    dir.appendChild(bAt);
    top.appendChild(dir);
    inner.appendChild(top);

    if (erro) { inner.appendChild(el('div', 'mc-warn', '<div>&#9888;</div><div>' + esc(erro) + '</div>')); return; }
    if (!dados) { inner.appendChild(el('div', 'mc-empty', 'lendo o LinkedIn...')); return; }
    const c = dados.conta;
    const cards = [
      { t: 'Seguidores', n: num(c.seguidores), s: c.ativa ? 'conectado · vale até ' + c.vence.split('-').reverse().join('/') : 'PRECISA RECONECTAR no Zernio', alerta: !c.ativa },
      { t: 'Agendados', n: String(dados.agendados.length), s: dados.agendados[0] ? 'próximo: ' + quando(dados.agendados[0].quando) : 'nada agendado' },
      { t: 'Publicados em 30 dias', n: String(dados.trinta.posts), s: 'pelo Zernio' },
      { t: 'Impressões em 30 dias', n: num(dados.trinta.impressoes), s: num(dados.trinta.reacoes) + ' reações (curtidas, comentários, compart.)' },
    ];
    const grid = el('div', 'gs-grid');
    for (const k of cards) grid.appendChild(el('div', 'gs-card li-card' + (k.alerta ? ' alerta' : ''), '<div class="gs-card-t">' + esc(k.t) + '</div><div class="gs-card-n">' + esc(k.n) + '</div><div class="gs-card-s">' + esc(k.s) + '</div>'));
    inner.appendChild(grid);

    const det = el('div', 'mc-card gs-det');
    const grupo = (titulo, corpo) => '<div class="mc-cob-sec"><div class="mc-cob-h">' + titulo + '</div>' + corpo + '</div>';
    det.innerHTML = (dados.falhas.length ? grupo('Com erro <span>' + dados.falhas.length + '</span>', dados.falhas.map(p => linha(p, false)).join('')) : '')
      + grupo('Agendados <span>' + dados.agendados.length + '</span>', dados.agendados.map(p => linha(p, false)).join('') || '<div class="mc-empty">nada agendado</div>')
      + grupo('Publicados <span>' + dados.publicados.length + '</span>', dados.publicados.map(p => linha(p, true)).join('') || '<div class="mc-empty">nenhum post publicado pelo Zernio ainda</div>')
      + '<div class="mc-form-note">' + esc(c.nome) + (c.perfil ? ' · <a href="' + esc(c.perfil) + '" target="_blank" rel="noopener">ver o perfil ↗</a>' : '')
      + '. Para publicar ou agendar, peça ao Claude ("publica o post da semana no LinkedIn"): ele mostra a prévia e só publica depois do seu sim. No perfil pessoal, os números só existem para os posts publicados pelo Zernio, e comentários e mensagens não passam pela API.</div>';
    inner.appendChild(det);
  }

  async function carregar() {
    carregando = true; erro = ''; render();
    try {
      const r = await fetch('/api/linkedin', { headers: { 'Content-Type': 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      dados = j;
    } catch (e) { erro = e.message; }
    carregando = false; render();
  }

  function abrir() {
    if (window.MissionControl) window.MissionControl.close();
    if (window.Gestao) window.Gestao.fechar();
    if (window.Tarefas) window.Tarefas.fechar();
    const root = $('#li-root');
    document.body.classList.add('mc-open', 'li-open');
    root.classList.add('on');
    window.__mcPaused = true;
    void root.offsetHeight;
    root.classList.add('in');
    render();
    carregar();
  }
  function fechar() {
    const root = $('#li-root');
    if (!root.classList.contains('on')) return;
    root.classList.remove('in');
    document.body.classList.remove('li-open');
    if (!document.querySelector('#mc-root.on') && !document.querySelector('#gs-root.on') && !document.querySelector('#tf-root.on')) { document.body.classList.remove('mc-open'); window.__mcPaused = false; }
    setTimeout(() => root.classList.remove('on'), 240);
  }
  const estaAberta = () => $('#li-root').classList.contains('on');

  addEventListener('DOMContentLoaded', () => {
    const root = el('div');
    root.id = 'li-root';
    root.innerHTML = '<div id="li-scroll"><div id="li-inner"></div></div>';
    document.body.appendChild(root);
    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape' && estaAberta()) { e.stopPropagation(); e.preventDefault(); fechar(); return; }
      if (!digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault(); e.stopPropagation(); estaAberta() ? fechar() : abrir();
      }
    }, true);
  });

  window.LinkedIn = { abrir, fechar };
})();
