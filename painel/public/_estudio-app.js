/* _estudio-app.js: o Estúdio de Conteúdo dentro do painel (botão ✦ ESTÚDIO, tecla E).

   O estúdio (~/estudio-conteudo/app) é quem cria, agenda e publica pelo Zernio, com as abas
   Semana, Pauta, Posts, Feed, Conversas (comentários e direct automático), Resultados e Ajustes.
   O painel pede o endereço em /api/estudio-app (que sobe o estúdio se precisar) e abre a tela
   num quadro. O estúdio fala com o painel por postMessage:
     estudio-fechar  -> volta pro grafo
     estudio-pecas   -> abre as peças do fluxo do OS (o Estúdio Social antigo, window.Estudio)
     estudio-navegar -> login de rede (Instagram, TikTok) no Zernio: abre na janela inteira e
                        volta em /?estudio=voltou, que reabre o estúdio já em Ajustes. */
'use strict';
(function () {
  let base = null;   // endereço do estúdio, ex. http://127.0.0.1:4747/
  const $ = s => document.querySelector(s);
  const aberto = () => $('#ea-root') && $('#ea-root').classList.contains('on');

  function msg(html) {
    const m = $('#ea-msg');
    m.innerHTML = html;
    m.style.display = html ? 'flex' : 'none';
  }

  async function abrir(extra) {
    if (window.MissionControl) window.MissionControl.close();
    if (window.Gestao) window.Gestao.fechar();
    if (window.Estudio) window.Estudio.fechar();
    const root = $('#ea-root');
    document.body.classList.add('mc-open', 'ea-open');
    window.__mcPaused = true;
    root.classList.add('on'); void root.offsetHeight; root.classList.add('in');
    const fr = $('#ea-frame');
    if (fr.src && !extra) { fr.focus(); return; }
    msg('<div class="ea-pulse"></div>Abrindo o estúdio');
    try {
      const r = await fetch('/api/estudio-app');
      const j = await r.json();
      if (j.instalado === false) { // sem o estúdio instalado, o botão abre as peças do OS
        fechar();
        if (window.Estudio) setTimeout(() => window.Estudio.abrir(), 250);
        return;
      }
      if (!j.url) throw new Error(j.erro || 'O estúdio não respondeu.');
      base = j.url;
      fr.onload = () => { msg(''); fr.focus(); };
      fr.src = base + (extra || '');
    } catch (e) {
      msg('<div class="ea-erro"></div><button type="button">VOLTAR</button>');
      $('#ea-msg .ea-erro').textContent = e.message;
      $('#ea-msg button').onclick = fechar;
    }
  }

  function fechar() {
    const root = $('#ea-root');
    if (!aberto()) return;
    root.classList.remove('in');
    document.body.classList.remove('ea-open');
    if (!document.querySelector('#mc-root.on') && !document.querySelector('#gs-root.on') && !document.querySelector('#es-root.on')) {
      document.body.classList.remove('mc-open'); window.__mcPaused = false;
    }
    setTimeout(() => root.classList.remove('on'), 240);
  }

  addEventListener('message', e => {
    if (!base || e.origin !== new URL(base).origin) return; // só a tela do estúdio fala com o painel
    const d = e.data || {};
    if (d.tipo === 'estudio-fechar') fechar();
    else if (d.tipo === 'estudio-pecas') { fechar(); if (window.Estudio) setTimeout(() => window.Estudio.abrir(), 250); }
    else if (d.tipo === 'estudio-navegar' && /^https:\/\//.test(String(d.url || ''))) location.href = d.url;
  });

  addEventListener('DOMContentLoaded', () => {
    const root = document.createElement('div');
    root.id = 'ea-root';
    root.innerHTML = '<iframe id="ea-frame" title="Estúdio de Conteúdo" allow="clipboard-write; autoplay; fullscreen"></iframe><div id="ea-msg"></div>';
    document.body.appendChild(root);

    const fab = document.createElement('button');
    fab.className = 'fab'; fab.id = 'fab-estudio'; fab.textContent = '✦ ESTÚDIO';
    fab.title = 'Estúdio de Conteúdo: criar, agendar e responder no Instagram e no TikTok (tecla E)';
    fab.onclick = () => aberto() ? fechar() : abrir();
    document.body.appendChild(fab);

    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (digitando || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && aberto()) { e.preventDefault(); e.stopPropagation(); fechar(); return; }
      if ((e.key === 'e' || e.key === 'E') && !document.querySelector('#es-root.on')) {
        e.preventDefault(); e.stopPropagation(); aberto() ? fechar() : abrir();
      }
    }, true);

    // volta do login no Zernio: reabre o estúdio em Ajustes, já conectado
    const q = new URLSearchParams(location.search);
    if (q.get('estudio') === 'voltou') {
      const ida = new URLSearchParams({ voltou: '1' });
      for (const k of ['connected', 'error']) if (q.get(k)) ida.set(k, q.get(k));
      history.replaceState(null, '', location.pathname);
      setTimeout(() => abrir('?' + ida.toString()), 600);
    }
  });

  window.EstudioApp = { abrir, fechar };
})();
