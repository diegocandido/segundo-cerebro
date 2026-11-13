/* _estudio.js - Estúdio Social (tecla E): as peças de rede social em 4 abas.

   Quadro: as peças por etapa (Em criação, Para aprovar, Aprovado, Publicado).
   Semana: o próximo post, os números e os 7 dias da semana, com o dia fixo de postar marcado.
   Posts:  lista com filtros e a prévia em tela de celular, como vai sair no Instagram
           (slides passando, carrossel vivo, legenda), mais todos os slides lado a lado.
   Feed:   como o perfil fica com as próximas peças em cima das publicadas.

   Com a tela aberta, ela relê as pastas a cada 8 segundos: dá para ver as peças nascendo
   enquanto o Claude gera. A conta da prévia e o dia de postar vêm do workspace.json
   (missionControl.estudioConta e estudioDiaPost).

   Também desenha a faixa "Estúdio Social" no Mission Control (window.Estudio.faixa).
   Só leitura: aprovar, agendar e postar continuam no Claude, com o "pode postar" do dono.

   Com o Estúdio de Conteúdo instalado (dados.conteudo), esta tela vira a PRODUÇÃO dele: só as
   abas Produção (o quadro) e Prévia, e a última coluna é "No Estúdio". Na Prévia de uma peça pronta,
   o botão "Mandar para o Estúdio" copia os slides e a legenda para a pasta postar do Estúdio de
   Conteúdo (POST /api/estudio/enviar), onde ela vira post para agendar. Semana, Feed, agenda e
   publicação ficam todos no Estúdio de Conteúdo. */
'use strict';
(function () {
  let dados = null;
  let aberta = null;      // id da peça aberta na aba Posts
  let timer = null;
  let aba = localStorage.getItem('es-aba') || 'quadro';
  let filtro = 'todos';
  let semana = 0;         // 0 = esta semana, -1 = a passada, 1 = a próxima
  let vivo = true;        // na prévia, mostrar o carrossel vivo quando houver
  const slideIdx = {};    // slide atual da prévia, por peça
  const legAberta = {};   // legenda expandida na prévia, por peça

  const ICO = {
    quadro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/></svg>',
    semana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    posts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>',
  };
  const ABAS = [['quadro', 'Quadro'], ['semana', 'Semana'], ['posts', 'Posts'], ['feed', 'Feed']];
  const ABAS_PRODUCAO = [['quadro', 'Produção'], ['posts', 'Prévia']]; // com o Estúdio de Conteúdo
  const producao = () => !!(dados && dados.conteudo);
  const abasDaTela = () => producao() ? ABAS_PRODUCAO : ABAS;
  let envio = {}; // resultado do último "Mandar para o Estúdio", por peça
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

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
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dataBR = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '';
  const diaDe = s => DIAS[new Date(s + 'T12:00').getDay()];
  const hoje = () => iso(new Date());
  const conta = () => (dados && dados.perfil && dados.perfil.conta) || 'suaconta';

  async function carregar() {
    try {
      const r = await fetch('/api/estudio');
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      dados = j;
    } catch (e) { dados = { erro: e.message, pecas: [], etapas: [], contagem: {} }; }
    return dados;
  }

  function irPara(novaAba, id) {
    aba = novaAba;
    localStorage.setItem('es-aba', aba);
    if (id !== undefined) aberta = id;
    render(true);
  }

  // ---------- cartão de uma peça ----------
  function cartao(p, mini, aoClicar) {
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
        : '<div class="es-selos">' + selos.join('') + '</div><div class="es-card-s">' + (p.etapa === 'estudio' ? 'enviada ' + esc(p.enviado || '') : (p.data ? esc(p.data) + ' · ' : '') + 'mexido ' + esc(quando(p.atualizado))) + '</div>')
      + '</div>';
    c.onclick = aoClicar || (() => { if (mini) abrir(p.id); else irPara('posts', p.id); });
    return c;
  }

  // ---------- aba Quadro ----------
  function abaQuadro(inner) {
    const quadro = el('div', 'es-quadro' + (dados.pauta ? ' com-pauta' : ''));
    for (const et of dados.etapas) {
      const col = el('div', 'es-vidro es-col' + (et.id === 'sugerida' || et.id === 'aprovada' ? ' es-col-pauta' : ''));
      if (et.id === 'sugerida' || et.id === 'aprovada') {
        const ideias = (dados.pauta || []).filter(i => et.id === 'sugerida' ? i.status === 'sugerida' : i.status !== 'sugerida')
          .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || String(b.sugerida).localeCompare(String(a.sugerida)));
        col.appendChild(el('div', 'es-col-h', esc(et.nome) + '<span>' + ideias.length + '</span>'));
        if (!ideias.length) col.appendChild(el('div', 'es-vazio', et.id === 'sugerida' ? 'as sugestões da pauta de segunda aparecem aqui' : '·'));
        for (const i of ideias) col.appendChild(cartaoIdeia(i));
      } else {
        const lista = dados.pecas.filter(x => (x.coluna || x.etapa) === et.id);
        col.appendChild(el('div', 'es-col-h', esc(et.nome) + '<span>' + lista.length + '</span>'));
        if (!lista.length) col.appendChild(el('div', 'es-vazio', '·'));
        for (const x of lista) col.appendChild(cartao(x));
      }
      quadro.appendChild(col);
    }
    inner.appendChild(quadro);
  }

  // ---------- pauta: cartão de uma ideia (Sugeridas e Aprovadas) ----------
  const FORMATOS = { carrossel: 'Carrossel', reel: 'Reel', reels: 'Reel', youtube: 'YouTube', linkedin: 'LinkedIn', story: 'Story', post: 'Post' };
  async function mudarIdeia(i, mud, msgOk) {
    try {
      const r = await fetch('/api/pauta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i.id, ...mud }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      await carregar(); render();
    } catch (e) { alert('Não deu: ' + e.message); }
  }
  function lerPrazo(atual) {
    const t = prompt('Prazo (DD/MM ou AAAA-MM-DD). Vazio tira o prazo.', atual ? dataBR(atual) + '/' + atual.slice(0, 4) : '');
    if (t === null) return undefined;
    if (!t.trim()) return '';
    let m = t.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return t.trim();
    m = t.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) { alert('Não entendi a data. Use DD/MM.'); return undefined; }
    let a = m[3] ? Number(m[3]) : new Date().getFullYear(); if (a < 100) a += 2000;
    return a + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  function cartaoIdeia(i) {
    const c = el('div', 'es-ideia st-' + i.status);
    const atrasada = i.prazo && i.prazo < hoje();
    const pills = [i.formato ? '<span class="es-selo">' + esc(FORMATOS[i.formato] || i.formato) + '</span>' : '',
      i.prazo ? '<span class="es-selo' + (atrasada ? ' atrasada' : '') + '">prazo ' + esc(dataBR(i.prazo)) + '</span>' : '',
      i.status === 'producao' ? '<span class="es-selo anim">em produção</span>' : '',
      i.origem === 'dono' ? '<span class="es-selo">sua</span>' : ''].join('');
    c.innerHTML = '<div class="es-card-t">' + esc(i.titulo) + '</div>' + (pills ? '<div class="es-selos">' + pills + '</div>' : '')
      + (i.gancho && i.gancho !== i.titulo ? '<div class="es-ideia-g">' + esc(i.gancho) + '</div>' : '')
      + '<div class="es-ideia-links">' + (i.roteiro ? '<a href="' + esc(i.roteiro) + '" target="_blank" rel="noopener">roteiro ↗</a>' : '')
      + (i.notion ? '<a href="' + esc(i.notion) + '" target="_blank" rel="noopener">Notion ↗</a>' : '') + '</div>';
    const acoes = el('div', 'es-ideia-acoes');
    const b = (t, cls, fn, title) => { const x = el('button', 'es-btn sm ' + (cls || ''), t); if (title) x.title = title; x.onclick = e => { e.stopPropagation(); fn(); }; acoes.appendChild(x); };
    if (i.status === 'sugerida') {
      b('Aprovar', 'prim', () => mudarIdeia(i, { status: 'aprovada' }));
      b('Prazo', '', () => { const p = lerPrazo(i.prazo); if (p !== undefined) mudarIdeia(i, { prazo: p }); });
      b('Descartar', 'fant', () => { if (confirm('Descartar "' + i.titulo + '"?')) mudarIdeia(i, { status: 'descartada' }); });
    } else {
      b('Pedir ao Claude', 'prim', async () => {
        const pedido = 'Faz a peça da pauta "' + i.titulo + '" (id ' + i.id + '), seguindo o fluxo do Social.';
        try { await navigator.clipboard.writeText(pedido); alert('Pedido copiado. Cole na conversa com o Claude:\n\n' + pedido); } catch { prompt('Copie e cole na conversa com o Claude:', pedido); }
      }, 'Copia o pedido para colar na conversa com o Claude');
      b('Prazo', '', () => { const p = lerPrazo(i.prazo); if (p !== undefined) mudarIdeia(i, { prazo: p }); });
      b('Voltar', 'fant', () => mudarIdeia(i, { status: 'sugerida' }), 'Volta para Sugeridas');
      b('Descartar', 'fant', () => { if (confirm('Descartar "' + i.titulo + '"?')) mudarIdeia(i, { status: 'descartada' }); });
    }
    c.appendChild(acoes);
    return c;
  }

  // ---------- aba Semana ----------
  function proximo() {
    const h = hoje();
    const fila = dados.pecas.filter(p => p.etapa !== 'publicado');
    const datadas = fila.filter(p => p.dataISO && p.dataISO >= h).sort((a, b) => a.dataISO < b.dataISO ? -1 : 1);
    if (datadas.length) return datadas[0];
    const ordem = { aprovado: 0, aprovar: 1, criando: 2 };
    return fila.slice().sort((a, b) => (ordem[a.etapa] - ordem[b.etapa]) || (b.atualizado - a.atualizado))[0] || null;
  }

  function abaSemana(inner) {
    const base = new Date(); base.setHours(12, 0, 0, 0);
    const seg = new Date(base); seg.setDate(base.getDate() - ((base.getDay() + 6) % 7) + semana * 7);
    const dias = [...Array(7)].map((_, i) => { const d = new Date(seg); d.setDate(seg.getDate() + i); return d; });
    const ini = iso(dias[0]), fim = iso(dias[6]);
    const diaPost = dados.perfil && dados.perfil.diaPost;
    const h = hoje();
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const daSemana = dados.pecas.filter(p => p.dataISO >= ini && p.dataISO <= fim);

    // título: saudação + resumo da semana
    const hora = new Date().getHours();
    const ola = hora < 12 ? 'Bom dia.' : hora < 18 ? 'Boa tarde.' : 'Boa noite.';
    const resumo = !daSemana.length ? 'Nenhum post nesta semana.' : daSemana.length === 1 ? '1 post nesta semana.' : daSemana.length + ' posts nesta semana.';
    const cab = el('div', 'es-ola');
    cab.innerHTML = '<div><div class="es-rot">semana de ' + dias[0].getDate() + ' a ' + dias[6].getDate() + ' de ' + MES[dias[6].getMonth()] + '</div>'
      + '<h1>' + (semana === 0 ? ola + ' ' : '') + '<span class="apagado">' + resumo + '</span></h1></div>';
    const nav = el('div', 'es-ola-nav');
    [['‹', -1], ['Hoje', 0], ['›', 1]].forEach(([t, d]) => {
      const b = el('button', 'es-btn sm', t);
      b.onclick = () => { semana = d === 0 ? 0 : semana + d; render(); };
      nav.appendChild(b);
    });
    cab.appendChild(nav);
    inner.appendChild(cab);

    // próximo post + números, lado a lado
    const hero = el('div', 'es-hero');
    const px = proximo();
    const prox = el(px ? 'button' : 'div', 'es-vidro es-prox' + (px ? '' : ' vazio'));
    if (px) {
      let falta = 'sem data';
      if (px.dataISO) {
        const dd = Math.round((new Date(px.dataISO + 'T12:00') - base) / 864e5);
        falta = dd <= 0 ? 'hoje' : dd === 1 ? 'amanhã' : 'em ' + dd + ' dias';
      }
      prox.innerHTML = '<div class="es-prox-capa">' + (px.capa ? '<img src="' + src(px, px.capa) + '" alt="">' : '') + '</div>'
        + '<div class="es-prox-b"><div class="es-rot ac">próximo post' + (px.dataISO ? ' · ' + diaDe(px.dataISO) + ', ' + dataBR(px.dataISO) : '') + '</div>'
        + '<h2>' + esc(px.titulo) + '</h2>'
        + '<div class="es-tags"><span class="es-tag ac">' + esc(px.etapaNome) + '</span>' + (px.imgs.length ? '<span class="es-tag">' + px.imgs.length + ' slides</span>' : '')
        + (px.vids.length ? '<span class="es-tag">▶ vivo</span>' : '') + '<span class="es-tag">' + esc(px.rede || 'Instagram') + '</span></div>'
        + '<div class="es-falta">' + falta + '</div>'
        + (!px.dataISO && diaPost != null ? '<div class="es-card-s">O seu dia fixo é ' + DIAS[diaPost] + '. Para marcar, diga ao Claude "essa sai ' + DIAS[diaPost] + '".</div>' : '')
        + '</div>';
      prox.onclick = () => irPara('posts', px.id);
    } else {
      prox.innerHTML = '<div class="es-prox-b"><div class="es-rot">próximo post</div><h2>Nada na fila</h2>'
        + '<div class="es-card-s">Peça um carrossel ao Claude ("faz um carrossel sobre ...") e ele aparece aqui, pronto para você aprovar.</div></div>';
    }
    hero.appendChild(prox);
    const c = dados.contagem || {};
    const noAr = dados.pecas.filter(p => p.etapa === 'publicado' && p.dataISO >= ini && p.dataISO <= fim).length;
    const nums = el('div', 'es-nums');
    [['em criação', c.criando || 0, 'o Claude está fazendo'], ['para aprovar', c.aprovar || 0, 'esperando o seu ok'],
      ['aprovadas', c.aprovado || 0, 'prontas para sair'], ['no ar na semana', noAr, 'publicadas de ' + dataBR(ini) + ' a ' + dataBR(fim)]]
      .forEach(([r, n, s]) => nums.appendChild(el('div', 'es-vidro es-num', '<div class="es-rot">' + r + '</div><div class="es-num-n">' + n + '</div><div class="es-card-s">' + s + '</div>')));
    hero.appendChild(nums);
    inner.appendChild(hero);

    // os 7 dias, com a capa grande de cada post
    inner.appendChild(el('div', 'es-sec-rot', '<span class="es-rot">agenda</span>' + (diaPost != null ? '<span class="es-card-s">dia fixo de postar: ' + DIAS[diaPost] + '</span>' : '')));
    const grade = el('div', 'es-dias');
    dias.forEach(d => {
      const k = iso(d);
      const fixo = d.getDay() === diaPost;
      const col = el('div', 'es-vidro es-dia' + (k === h ? ' hoje' : '') + (fixo ? ' fixo' : ''));
      col.appendChild(el('div', 'es-dia-h', '<span>' + DIAS[d.getDay()] + '</span><b>' + d.getDate() + '</b>'));
      const corpo = el('div', 'es-dia-c');
      const doDia = dados.pecas.filter(p => p.dataISO === k);
      doDia.forEach(p => {
        const b = el('button', 'es-dia-p et-' + p.etapa, '<div class="es-dia-capa">' + (p.capa ? '<img src="' + src(p, p.capa) + '" alt="" loading="lazy">' : '')
          + (p.imgs.length > 1 ? '<span class="es-qt">' + p.imgs.length + '</span>' : '') + '</div>'
          + '<div class="es-dia-t">' + esc(p.titulo) + '</div><span class="es-pill et-' + p.etapa + '">' + esc(p.etapaNome) + '</span>');
        b.onclick = () => irPara('posts', p.id);
        corpo.appendChild(b);
      });
      if (!doDia.length) corpo.appendChild(el('div', 'es-slot', fixo && k >= h ? 'dia de postar · livre' : fixo ? 'dia de postar' : ''));
      col.appendChild(corpo);
      grade.appendChild(col);
    });
    inner.appendChild(grade);

    const semData = dados.pecas.filter(p => p.etapa !== 'publicado' && !p.dataISO);
    if (semData.length) {
      inner.appendChild(el('div', 'es-sec-rot', '<span class="es-rot">sem data ainda · ' + semData.length + '</span><span class="es-card-s">a data vem da linha "data:" do status.txt da peça</span>'));
      const fila = el('div', 'es-faixa-fila');
      semData.forEach(p => fila.appendChild(cartao(p, true, () => irPara('posts', p.id))));
      inner.appendChild(fila);
    }
  }

  // ---------- aba Posts ----------
  function celular(p) {
    const usarVivo = vivo && p.vids.length > 0;
    const midias = usarVivo ? p.vids : p.imgs;
    const n = midias.length;
    const i = Math.min(slideIdx[p.id] || 0, Math.max(0, n - 1));
    const tel = el('div', 'es-tel');
    tel.innerHTML = '<div class="es-tel-top"><img class="es-tel-av" src="/logo.png" alt=""><b>' + esc(conta()) + '</b><span>···</span></div>';
    const tela = el('div', 'es-tel-midia');
    if (!n) tela.innerHTML = '<div class="es-sem-capa">' + (p.slidesHtml ? 'slides em HTML, ainda sem imagem' : 'ainda sem imagem') + '</div>';
    else {
      const f = midias[i];
      tela.innerHTML = usarVivo
        ? '<video src="' + src(p, f) + '" muted loop playsinline autoplay preload="metadata"></video>'
        : '<img src="' + src(p, f) + '" alt="slide ' + (i + 1) + '">';
      if (n > 1) {
        tela.appendChild(el('div', 'es-tel-cont', (i + 1) + '/' + n));
        if (i > 0) { const a = el('button', 'es-tel-seta esq', '‹'); a.onclick = () => { slideIdx[p.id] = i - 1; render(); }; tela.appendChild(a); }
        if (i < n - 1) { const a = el('button', 'es-tel-seta dir', '›'); a.onclick = () => { slideIdx[p.id] = i + 1; render(); }; tela.appendChild(a); }
      }
    }
    tel.appendChild(tela);
    const pontos = n > 1 ? '<div class="es-tel-pontos">' + midias.map((_, k) => '<i' + (k === i ? ' class="on"' : '') + '></i>').join('') + '</div>' : '<div class="es-tel-pontos"></div>';
    tel.appendChild(el('div', 'es-tel-acoes', '<span>♡</span><span>◯</span><span>➤</span>' + pontos + '<span>⌑</span>'));
    if (p.legenda) {
      const curta = p.legenda.length > 125 && !legAberta[p.id];
      const texto = curta ? p.legenda.slice(0, 125).replace(/\s+\S*$/, '') : p.legenda;
      const leg = el('div', 'es-tel-leg', '<b>' + esc(conta()) + '</b> ' + esc(texto) + (curta ? ' <button class="es-tel-mais">... mais</button>' : ''));
      const mais = leg.querySelector('.es-tel-mais');
      if (mais) mais.onclick = () => { legAberta[p.id] = true; render(); };
      tel.appendChild(leg);
    }
    tel.appendChild(el('div', 'es-tel-data', p.dataISO ? diaDe(p.dataISO) + ', ' + dataBR(p.dataISO) : esc(p.etapaNome)));
    return tel;
  }

  function abaPosts(inner) {
    const wrap = el('div', 'es-posts');
    const lado = el('div', 'es-vidro es-lista');
    const filtros = el('div', 'es-filtros');
    [['todos', 'Todos'], ...dados.etapas.map(e => [e.id, e.nome])].forEach(([id, nome]) => {
      const b = el('button', 'es-filtro' + (filtro === id ? ' on' : ''), esc(nome));
      b.onclick = () => { filtro = id; render(); };
      filtros.appendChild(b);
    });
    lado.appendChild(filtros);
    const lista = dados.pecas.filter(p => filtro === 'todos' || (p.coluna || p.etapa) === filtro);
    if (!lista.length) lado.appendChild(el('div', 'es-vazio', 'nada aqui'));
    lista.forEach(p => {
      const b = el('button', 'es-item' + (p.id === aberta ? ' on' : ''),
        '<div class="es-item-capa">' + (p.capa ? '<img src="' + src(p, p.capa) + '" alt="" loading="lazy">' : '') + '</div>'
        + '<div><div class="es-card-t">' + esc(p.titulo) + '</div><div class="es-selos"><span class="es-pill et-' + p.etapa + '">' + esc(p.etapaNome) + '</span>'
        + (p.vids.length ? '<span class="es-selo anim">▶ vivo</span>' : '') + (p.imgs.length ? '<span class="es-selo">' + p.imgs.length + ' slides</span>' : '') + '</div></div>');
      b.onclick = () => { aberta = p.id; render(); };
      lado.appendChild(b);
    });
    wrap.appendChild(lado);

    const p = dados.pecas.find(x => x.id === aberta);
    const dir = el('div', 'es-vidro es-prev');
    if (!p) {
      dir.appendChild(el('div', 'es-escolha', '<div class="es-prox-t">Escolha um post</div><div class="es-card-s">Clique numa peça da lista para ver como ela sai no celular.</div>'));
    } else {
      const top = el('div', 'es-det-top');
      top.innerHTML = '<div><div class="es-det-etapa">' + esc(p.etapaNome) + (p.agora ? ' · <b>fazendo agora</b>' : '') + '</div>'
        + '<div class="es-det-t">' + esc(p.titulo) + '</div><div class="es-card-s">' + esc(p.onde) + '</div></div>';
      if (p.vids.length && p.imgs.length) {
        const tg = el('div', 'es-filtros');
        [[false, 'Estático'], [true, 'Vivo']].forEach(([v, t]) => {
          const b = el('button', 'es-filtro' + (vivo === v ? ' on' : ''), t);
          b.onclick = () => { vivo = v; render(); };
          tg.appendChild(b);
        });
        top.appendChild(tg);
      }
      dir.appendChild(top);
      const corpo = el('div', 'es-prev-corpo');
      corpo.appendChild(celular(p));
      const info = el('div', 'es-prev-info');
      const linhas = [['Etapa', esc(p.etapaNome)], ['Data', p.dataISO ? diaDe(p.dataISO) + ', ' + dataBR(p.dataISO) : 'sem data'],
        ['Rede', esc(p.rede || 'Instagram')], ['Conta', '@' + esc(conta())], ['Mexido', esc(quando(p.atualizado))]];
      info.innerHTML = linhas.map(([k, v]) => '<div class="es-info-l"><span>' + k + '</span><b>' + v + '</b></div>').join('');
      if (p.link) info.appendChild(el('div', 'mc-form-note', '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">Abrir o post publicado</a>'));
      if (p.vids.length) {
        const som = el('button', 'act', 'Tocar com som');
        som.onclick = () => dir.querySelectorAll('video').forEach(v => { v.muted = false; v.currentTime = 0; v.play(); });
        info.appendChild(som);
      }
      if (producao()) info.appendChild(blocoEnviar(p));
      else info.appendChild(el('div', 'mc-form-note', 'Para aprovar, pedir ajuste, marcar a data ou postar, fale com o Claude ("aprovado", "troca a capa", "sai quinta", "pode postar"). O Estúdio só mostra.'));
      corpo.appendChild(info);
      dir.appendChild(corpo);
      if (p.imgs.length) {
        dir.appendChild(el('div', 'mc-cob-h', 'Todos os slides <span>' + p.imgs.length + '</span>'));
        const tira = el('div', 'es-tira');
        p.imgs.forEach((f, i) => {
          const fig = el('figure', '', '<img src="' + src(p, f) + '" alt="slide ' + (i + 1) + '" loading="lazy"><figcaption>' + String(i + 1).padStart(2, '0') + '</figcaption>');
          fig.onclick = () => { slideIdx[p.id] = i; vivo = false; render(); };
          tira.appendChild(fig);
        });
        dir.appendChild(tira);
      }
    }
    wrap.appendChild(dir);
    inner.appendChild(wrap);
  }

  // ---------- Mandar para o Estúdio de Conteúdo ----------
  function blocoEnviar(p) {
    const box = el('div', 'es-enviar');
    const r = envio[p.id];
    const abrirEstudio = () => { fecharTela(); if (window.EstudioApp) setTimeout(() => window.EstudioApp.abrir(), 250); };
    if (r && r.ok) {
      box.innerHTML = '<div class="es-enviar-ok">Enviada para o Estúdio: ' + r.arquivos + (r.formato === 'vivo' ? ' vídeo(s)' : ' slide(s)') + (r.legenda ? ' com a legenda' : ', sem legenda') + '.</div>'
        + '<div class="mc-form-note">Em alguns segundos ela aparece em Posts do Estúdio, sem data. Lá você confere e agenda.</div>';
      const b = el('button', 'act', 'Abrir o Estúdio'); b.onclick = abrirEstudio; box.appendChild(b);
      return box;
    }
    if (p.etapa === 'estudio' || p.etapa === 'publicado') {
      box.innerHTML = '<div class="mc-form-note">' + (p.etapa === 'estudio' ? 'Esta peça já está no Estúdio' + (p.enviado ? ' (enviada ' + esc(p.enviado) + ')' : '') + '. Agendar e publicar é por lá.' : 'Esta peça já foi publicada.') + '</div>';
      const b = el('button', 'act', 'Abrir o Estúdio'); b.onclick = abrirEstudio; box.appendChild(b);
      return box;
    }
    if (p.etapa === 'criando' || (!p.imgs.length && !p.vids.length)) {
      box.innerHTML = '<div class="mc-form-note">Ainda em criação. Quando os slides estiverem prontos, ela pode ir para o Estúdio. Ajustes: fale com o Claude ("troca a capa").</div>';
      return box;
    }
    const usarVivo = vivo && p.vids.length > 0;
    const qt = usarVivo ? p.vids.length + ' vídeo(s) do carrossel vivo' : p.imgs.length + ' slide(s)';
    const b = el('button', 'act es-enviar-b', p.etapa === 'aprovar' ? 'Aprovar e mandar para o Estúdio' : 'Mandar para o Estúdio');
    b.onclick = async () => {
      if (!confirm('Mandar "' + p.titulo + '" para o Estúdio de Conteúdo?\n\nVão ' + qt + (p.legenda ? ' e a legenda' : ' (sem legenda)') + '. Ela entra em Posts sem data: nada é agendado nem publicado sem você.')) return;
      b.disabled = true; b.textContent = 'Enviando...';
      try {
        const res = await fetch('/api/estudio/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, formato: usarVivo ? 'vivo' : 'estatico' }) });
        const j = await res.json();
        if (!res.ok || j.error) throw new Error(j.error || 'HTTP ' + res.status);
        envio[p.id] = j;
        await carregar();
      } catch (e) { envio[p.id] = null; alert('Não deu para enviar: ' + e.message); }
      render();
    };
    box.appendChild(el('div', 'mc-form-note', 'Vão ' + qt + (p.legenda ? ' e a legenda' : ' (sem legenda.txt)') + (p.vids.length && p.imgs.length ? '. Troque Estático/Vivo acima para escolher.' : '.') + ' Para pedir ajuste antes, fale com o Claude.'));
    box.appendChild(b);
    return box;
  }

  // ---------- aba Feed ----------
  function abaFeed(inner) {
    const desc = (a, b) => (b < a ? -1 : b > a ? 1 : 0);
    // o que ainda não saiu fica em cima: sem data no topo, depois a data mais distante
    const fila = dados.pecas.filter(p => p.etapa !== 'publicado').sort((a, b) => desc(a.dataISO || '9999', b.dataISO || '9999') || b.atualizado - a.atualizado);
    const pub = dados.pecas.filter(p => p.etapa === 'publicado').sort((a, b) => desc(a.dataISO || '', b.dataISO || '') || b.atualizado - a.atualizado);
    const wrap = el('div', 'es-vidro es-feed');
    wrap.appendChild(el('div', 'es-feed-perfil', '<img class="es-feed-av" src="/logo.png" alt=""><div><div class="es-prox-t">' + esc(conta()) + '</div>'
      + '<div class="es-card-s"><b>' + pub.length + '</b> publicadas pelo OS · <b>' + fila.length + '</b> na fila</div></div>'));
    const grade = el('div', 'es-feed-grade');
    [...fila, ...pub].forEach(p => {
      const b = el('button', 'es-feed-i' + (p.etapa !== 'publicado' ? ' fila' : ''),
        (p.capa ? '<img src="' + src(p, p.capa) + '" alt="" loading="lazy">' : '<div class="es-sem-capa">sem capa</div>')
        + (p.imgs.length > 1 ? '<span class="es-feed-ic">❐</span>' : '')
        + (p.etapa !== 'publicado' ? '<span class="es-feed-et">' + esc(p.etapaNome) + (p.dataISO ? ' · ' + dataBR(p.dataISO) : '') + '</span>' : ''));
      b.title = p.titulo;
      b.onclick = () => irPara('posts', p.id);
      grade.appendChild(b);
    });
    if (!fila.length && !pub.length) grade.appendChild(el('div', 'es-vazio', 'nenhuma peça ainda'));
    wrap.appendChild(grade);
    const duas = el('div', 'es-feed-wrap');
    duas.appendChild(wrap);
    duas.appendChild(el('div', 'es-feed-lado', '<h2>Como o seu perfil vai ficar</h2>'
      + '<p>Em cima, com borda tracejada na cor da marca, as peças que ainda vão sair, da data mais distante para a mais perto. Embaixo, o que já foi publicado pelo OS.</p>'
      + '<p>Olhe a grade como um todo: capas parecidas lado a lado cansam. Se duas seguidas ficaram com a mesma cara, peça ao Claude para trocar a capa de uma.</p>'
      + '<p class="es-card-s">Só aparece o que passou pelo OS. Clique numa capa para ver a peça no celular.</p>'));
    inner.appendChild(duas);
  }

  // ---------- tela ----------
  function render(doTopo) {
    const raiz = $('#es-inner');
    if (!raiz) return;
    const B = window.BRAND || {};
    const sc = $('#es-scroll');
    const rolagem = sc && !doTopo ? sc.scrollTop : 0;
    const root = $('#es-root');
    if (root && dados && dados.perfil && dados.perfil.cor) root.style.setProperty('--es-marca', dados.perfil.cor);
    raiz.innerHTML = '';

    // barra do topo, no jeito do Estúdio de conteúdo: marca, abas com ícone, ações
    const topo = el('div', 'es-topo');
    const marca = el('button', 'es-marca', '<img src="/logo.png" alt=""><div><div class="es-marca-n">' + esc(B.nome || 'Cara da IA') + (producao() ? ' · Produção' : ' · Estúdio') + '</div>'
      + '<div class="es-marca-s">' + (dados && dados.perfil && dados.perfil.conta ? '@' + esc(dados.perfil.conta) : 'conteúdo das redes') + '</div></div>');
    marca.title = 'Voltar pro grafo do cérebro';
    marca.onclick = fecharTela;
    topo.appendChild(marca);
    const abas = el('div', 'es-abas');
    const c = (dados && dados.contagem) || {};
    abasDaTela().forEach(([id, nome]) => {
      const n = id === 'posts' ? (c.aprovar || 0) : 0;
      const b = el('button', 'es-aba' + (aba === id ? ' on' : ''), ICO[id] + '<span>' + nome + '</span>' + (n ? '<i class="es-cont">' + n + '</i>' : ''));
      if (n) b.title = n + ' para aprovar';
      b.onclick = () => irPara(id);
      abas.appendChild(b);
    });
    topo.appendChild(abas);
    const dir = el('div', 'es-topo-dir');
    if (dados && dados.geradoEm) dir.appendChild(el('div', 'es-relogio', '<b>' + esc(String(dados.geradoEm).slice(11, 16)) + '</b><span>relendo a cada 8 s</span>'));
    const bAt = el('button', 'es-btn', 'Atualizar');
    bAt.onclick = () => carregar().then(() => render());
    if (producao()) { // volta para o Estúdio de Conteúdo
      const bEs = el('button', 'es-btn', '✦ Estúdio');
      bEs.title = 'Voltar para o Estúdio de Conteúdo (agenda, posts, feed)';
      bEs.onclick = () => { fecharTela(); if (window.EstudioApp) setTimeout(() => window.EstudioApp.abrir(), 250); };
      dir.appendChild(bEs);
    }
    const bMc = el('button', 'es-btn', 'Mission Control');
    bMc.onclick = () => { fecharTela(); window.MissionControl && window.MissionControl.open(); };
    const bX = el('button', 'es-btn fant', '✕');
    bX.title = 'Fechar (Esc)';
    bX.onclick = fecharTela;
    dir.appendChild(bAt); dir.appendChild(bMc); dir.appendChild(bX);
    topo.appendChild(dir);
    raiz.appendChild(topo);
    const inner = el('div', 'es-main');
    raiz.appendChild(inner);

    if (!dados) { inner.appendChild(el('div', 'mc-empty', 'lendo as peças...')); return; }
    if (dados.erro) { inner.appendChild(el('div', 'mc-warn', '<div>&#9888;</div><div>' + esc(dados.erro) + '</div>')); return; }

    if (!dados.pecas.length) {
      const onde = dados.fontes.map(f => '<code>' + esc(f.pasta) + '</code>' + (f.existe ? '' : ' (ainda não existe)')).join(' e ');
      inner.appendChild(el('div', 'mc-warn', '<div>✦</div><div><b>Nenhuma peça ainda.</b> Peça um carrossel ao Claude ("faz um carrossel sobre ...") e ele aparece aqui, '
        + 'na coluna Em criação, e vai andando até Publicado. O Estúdio procura em ' + onde + '.</div>'));
    }
    if (!abasDaTela().some(([id]) => id === aba)) aba = 'quadro'; // Semana e Feed não existem na Produção
    if (aba === 'posts' && !dados.pecas.find(x => x.id === aberta) && dados.pecas.length) aberta = dados.pecas[0].id;
    ({ quadro: abaQuadro, semana: abaSemana, posts: abaPosts, feed: abaFeed }[aba] || abaQuadro)(inner);
    if (sc) sc.scrollTop = rolagem;
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
      h.innerHTML = (d.conteudo ? 'Produção do Estúdio' : 'Estúdio Social') + '<span class="mc-h-note">' + (c.criando || 0) + ' em criação · ' + (c.aprovar || 0) + ' para aprovar · ' + (c.aprovado || 0) + ' aprovada(s)' + (d.conteudo ? ' · ' + (c.estudio || 0) + ' no Estúdio' : '') + (d.pauta ? ' · ' + (c.sugerida || 0) + ' sugestão(ões) da pauta' : '') + '</span>';
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
    if (id) { aberta = id; aba = 'posts'; }
    render(true);
    carregar().then(() => render());
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
    // o botão ✦ ESTÚDIO e a tecla E agora abrem o Estúdio de Conteúdo (_estudio-app.js);
    // estas peças abrem pelo botão "Peças" de lá, pela faixa do Mission Control e pelo ✦ ESTÚDIO quando o estúdio não está instalado.
    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape' && estaAberta()) {
        const drawer = document.getElementById('brain-viewer');
        if (drawer && drawer.classList.contains('open')) return;
        e.stopPropagation(); e.preventDefault();
        if (aba !== 'quadro') irPara('quadro'); else fecharTela();
        return;
      }
      // setas trocam o slide da prévia na aba Posts
      if (estaAberta() && !digitando && aba === 'posts' && aberta && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const p = dados && dados.pecas && dados.pecas.find(x => x.id === aberta);
        if (p) {
          const n = (vivo && p.vids.length ? p.vids : p.imgs).length;
          const i = (slideIdx[p.id] || 0) + (e.key === 'ArrowRight' ? 1 : -1);
          if (i >= 0 && i < n) { slideIdx[p.id] = i; render(); }
          e.preventDefault();
        }
        return;
      }
      if (estaAberta() && !digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault(); e.stopPropagation(); fecharTela(); // E fecha as peças; abrir é com o Estúdio
      }
    }, true);
  });

  window.Estudio = { abrir, fechar: fecharTela, faixa };
})();
