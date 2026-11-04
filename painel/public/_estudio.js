/* _estudio.js - Estúdio Social (tecla E): as peças de rede social em quadro, por etapa.

   Cada carrossel ou card que o Claude está fazendo aparece como um cartão com a capa, na coluna
   da etapa: Em criação, Para aprovar, Aprovado, Publicado. Clicar abre os slides em tamanho de
   celular, os vídeos do carrossel vivo e a legenda. Com a tela aberta, ela relê as pastas a cada
   8 segundos: dá para ver as peças nascendo enquanto o Claude gera.

   Também desenha a faixa "Estúdio Social" no Mission Control (window.Estudio.faixa).
   Só leitura: aprovar e postar continuam no Claude, com o "pode postar" do dono. */
'use strict';
(function () {
  let dados = null;
  let aberta = null;      // id da peça aberta no detalhe
  let timer = null;

  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const src = (p, f) => '/api/estudio/midia?id=' + encodeURIComponent(p.id) + '&f=' + encodeURIComponent(f) + '&v=' + Math.round(p.atualizado);
  const quando = ms => {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return 'há ' + h + ' h';
    return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  async function carregar() {
    try {
      const r = await fetch('/api/estudio');
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      dados = j;
    } catch (e) { dados = { erro: e.message, pecas: [], etapas: [], contagem: {} }; }
    return dados;
  }

  // ---------- cartão de uma peça ----------
  function cartao(p, mini) {
    const c = el('button', 'es-card' + (p.agora ? ' agora' : '') + (mini ? ' mini' : ''));
    const capa = p.capa
      ? '<img src="' + src(p, p.capa) + '" alt="" loading="lazy">'
      : '<div class="es-sem-capa">' + (p.slidesHtml ? p.slidesHtml + ' slide(s) em HTML<br>ainda sem imagem' : (p.temBrief ? 'roteiro e copy<br>em andamento' : 'começando')) + '</div>';
    const selos = [];
    if (p.agora) selos.push('<span class="es-selo vivo-agora">● fazendo agora</span>');
    if (p.imgs.length) selos.push('<span class="es-selo">' + p.imgs.length + ' slide' + (p.imgs.length > 1 ? 's' : '') + '</span>');
    if (p.vids.length) selos.push('<span class="es-selo anim">▶ vivo</span>');
    if (p.rede) selos.push('<span class="es-selo">' + esc(p.rede) + '</span>');
    c.innerHTML = '<div class="es-capa">' + capa + '</div>'
      + '<div class="es-card-b"><div class="es-card-t">' + esc(p.titulo) + '</div>'
      + (mini ? '<div class="es-card-s">' + esc(p.etapaNome) + ' · ' + esc(quando(p.atualizado)) + '</div>'
        : '<div class="es-selos">' + selos.join('') + '</div><div class="es-card-s">' + (p.data ? esc(p.data) + ' · ' : '') + 'mexido ' + esc(quando(p.atualizado)) + '</div>')
      + '</div>';
    c.onclick = () => { if (mini) abrir(p.id); else { aberta = p.id; render(); } };
    return c;
  }

  // ---------- detalhe ----------
  function detalhe(p) {
    const box = el('div', 'es-det');
    const top = el('div', 'es-det-top');
    top.innerHTML = '<div><div class="es-det-etapa">' + esc(p.etapaNome) + (p.agora ? ' · <b>fazendo agora</b>' : '') + '</div>'
      + '<div class="es-det-t">' + esc(p.titulo) + '</div><div class="es-card-s">' + esc(p.onde) + '</div></div>';
    const fechar = el('button', 'act', 'Fechar');
    fechar.onclick = () => { aberta = null; render(); };
    top.appendChild(fechar);
    box.appendChild(top);

    if (p.imgs.length) {
      box.appendChild(el('div', 'mc-cob-h', 'Slides <span>' + p.imgs.length + '</span>'));
      const tira = el('div', 'es-tira');
      p.imgs.forEach((f, i) => {
        const fig = el('figure', '', '<img src="' + src(p, f) + '" alt="slide ' + (i + 1) + '"><figcaption>' + String(i + 1).padStart(2, '0') + '</figcaption>');
        fig.onclick = () => window.open(src(p, f), '_blank');
        tira.appendChild(fig);
      });
      box.appendChild(tira);
    } else {
      box.appendChild(el('div', 'mc-empty', 'Ainda sem imagens. Quando o Claude renderizar os slides, eles aparecem aqui sozinhos.'));
    }
    if (p.vids.length) {
      box.appendChild(el('div', 'mc-cob-h', 'Carrossel vivo <span>' + p.vids.length + ' vídeo(s)</span>'));
      const tira = el('div', 'es-tira');
      p.vids.forEach((f, i) => tira.appendChild(el('figure', '', '<video src="' + src(p, f) + '" muted loop playsinline autoplay preload="metadata"></video><figcaption>' + String(i + 1).padStart(2, '0') + '</figcaption>')));
      box.appendChild(tira);
      const som = el('button', 'act', 'Tocar com som');
      som.onclick = () => box.querySelectorAll('video').forEach(v => { v.muted = false; v.currentTime = 0; v.play(); });
      box.appendChild(som);
    }
    if (p.legenda) {
      box.appendChild(el('div', 'mc-cob-h', 'Legenda'));
      box.appendChild(el('pre', 'es-legenda', esc(p.legenda)));
    }
    if (p.link) box.appendChild(el('div', 'mc-form-note', '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">Abrir o post publicado</a>'));
    box.appendChild(el('div', 'mc-form-note', 'Para aprovar, pedir ajuste ou postar, fale com o Claude ("aprovado", "troca a capa", "pode postar"). O Estúdio só mostra.'));
    return box;
  }

  // ---------- tela ----------
  function render() {
    const inner = $('#es-inner');
    if (!inner) return;
    const B = window.BRAND || {};
    inner.innerHTML = '';
    const top = el('div', 'mc-top');
    const back = el('button', 'mc-back', '<span class="mc-back-arrow">&#9666;</span><div><div><span class="mc-back-name">' + esc(B.nome || 'Cara da IA')
      + '</span><span class="mc-back-os">Estúdio</span></div><div class="mc-back-sub">voltar pro grafo do cérebro</div></div>');
    back.onclick = fecharTela;
    top.appendChild(back);
    const dir = el('div', 'mc-top-right');
    const bMc = el('button', 'act', 'Mission Control');
    bMc.onclick = () => { fecharTela(); window.MissionControl && window.MissionControl.open(); };
    const bAt = el('button', 'act', 'Atualizar');
    bAt.onclick = () => carregar().then(render);
    dir.appendChild(bMc); dir.appendChild(bAt);
    if (dados && dados.geradoEm) dir.appendChild(el('div', 'mc-clock', '<div class="mc-clock-d">' + esc(String(dados.geradoEm).slice(11, 16)) + '</div><div class="mc-clock-s">relendo a cada 8 s</div>'));
    top.appendChild(dir);
    inner.appendChild(top);

    if (!dados) { inner.appendChild(el('div', 'mc-empty', 'lendo as peças...')); return; }
    if (dados.erro) { inner.appendChild(el('div', 'mc-warn', '<div>&#9888;</div><div>' + esc(dados.erro) + '</div>')); return; }

    const p = aberta && dados.pecas.find(x => x.id === aberta);
    if (p) inner.appendChild(detalhe(p));

    if (!dados.pecas.length) {
      const onde = dados.fontes.map(f => '<code>' + esc(f.pasta) + '</code>' + (f.existe ? '' : ' (ainda não existe)')).join(' e ');
      inner.appendChild(el('div', 'mc-warn', '<div>✦</div><div><b>Nenhuma peça ainda.</b> Peça um carrossel ao Claude ("faz um carrossel sobre ...") e ele aparece aqui, '
        + 'na coluna Em criação, e vai andando até Publicado. O Estúdio procura em ' + onde + '.</div>'));
    }
    const quadro = el('div', 'es-quadro');
    for (const et of dados.etapas) {
      const col = el('div', 'es-col');
      const lista = dados.pecas.filter(x => x.etapa === et.id);
      col.appendChild(el('div', 'es-col-h', esc(et.nome) + '<span>' + lista.length + '</span>'));
      if (!lista.length) col.appendChild(el('div', 'es-vazio', '·'));
      for (const x of lista) col.appendChild(cartao(x));
      quadro.appendChild(col);
    }
    inner.appendChild(quadro);
  }

  // ---------- faixa no Mission Control ----------
  function faixa(container) {
    const box = el('div', 'es-faixa');
    box.appendChild(el('div', 'mc-h', 'Estúdio Social<span class="mc-h-note">lendo...</span>'));
    container.appendChild(box);
    carregar().then(d => {
      box.innerHTML = '';
      const ativos = (d.pecas || []).filter(p => p.etapa !== 'publicado');
      const h = el('div', 'mc-h es-faixa-h');
      const c = d.contagem || {};
      h.innerHTML = 'Estúdio Social<span class="mc-h-note">' + (c.criando || 0) + ' em criação · ' + (c.aprovar || 0) + ' para aprovar · ' + (c.aprovado || 0) + ' aprovada(s)</span>';
      const ver = el('button', 'act', 'Abrir o Estúdio (E)');
      ver.onclick = () => abrir();
      h.appendChild(ver);
      box.appendChild(h);
      if (d.erro) { box.appendChild(el('div', 'mc-empty', d.erro)); return; }
      if (!ativos.length) { box.appendChild(el('div', 'mc-empty', 'Nada em produção. Peça um carrossel ao Claude e ele aparece aqui.')); return; }
      const fila = el('div', 'es-faixa-fila');
      ativos.slice(0, 8).forEach(p => fila.appendChild(cartao(p, true)));
      box.appendChild(fila);
    });
    return box;
  }

  // ---------- abrir / fechar ----------
  function abrir(id) {
    if (window.MissionControl) window.MissionControl.close();
    if (window.Gestao) window.Gestao.fechar();
    const root = $('#es-root');
    document.body.classList.add('mc-open', 'es-open');
    root.classList.add('on');
    window.__mcPaused = true;
    void root.offsetHeight;
    root.classList.add('in');
    aberta = id || aberta;
    render();
    carregar().then(render);
    clearInterval(timer);
    timer = setInterval(async () => {
      if (document.hidden) return;
      const antes = JSON.stringify(dados && dados.pecas);
      await carregar();
      if (JSON.stringify(dados && dados.pecas) !== antes) render(); // só redesenha se alguma peça mudou (não reinicia os vídeos)
    }, 8000);
  }
  function fecharTela() {
    const root = $('#es-root');
    if (!root || !root.classList.contains('on')) return;
    clearInterval(timer); timer = null;
    root.classList.remove('in');
    document.body.classList.remove('es-open');
    if (!document.querySelector('#mc-root.on') && !document.querySelector('#gs-root.on')) { document.body.classList.remove('mc-open'); window.__mcPaused = false; }
    setTimeout(() => root.classList.remove('on'), 240);
  }
  const estaAberta = () => $('#es-root').classList.contains('on');

  addEventListener('DOMContentLoaded', () => {
    const root = el('div');
    root.id = 'es-root';
    root.innerHTML = '<div id="es-scroll"><div id="es-inner"></div></div>';
    document.body.appendChild(root);
    const fab = el('button', 'fab', '✦ ESTÚDIO');
    fab.id = 'fab-estudio';
    fab.onclick = () => estaAberta() ? fecharTela() : abrir();
    document.body.appendChild(fab);
    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape' && estaAberta()) {
        const drawer = document.getElementById('brain-viewer');
        if (drawer && drawer.classList.contains('open')) return;
        e.stopPropagation(); e.preventDefault();
        if (aberta) { aberta = null; render(); } else fecharTela();
        return;
      }
      if (!digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault(); e.stopPropagation(); estaAberta() ? fecharTela() : abrir();
      }
    }, true);
  });

  window.Estudio = { abrir, fechar: fecharTela, faixa };
})();
