/* _direct.js - tela Mensagens (tecla D): o direct do Instagram dentro do painel.

   Esquerda: as conversas (não lidas no alto, com o número). Direita: a conversa aberta, como um
   chat, e a caixa de resposta. "Sugerir resposta" pede à IA (o Claude, lendo o segundo cérebro) o
   texto da próxima mensagem na voz do dono; o texto cai na caixa para revisar e editar. Nada sai
   sem o clique em Enviar. Relê a conversa aberta a cada 20 s e a lista a cada 60 s. */
'use strict';
(function () {
  let lista = null, erroLista = '', aberta = null, conversa = null, erroConversa = '';
  let filtro = 'todas', busca = '', sugerindo = false, enviando = false, aviso = '';
  let timerConversa = null, timerLista = null;
  const rascunho = {}; // texto da caixa, por conversa
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hora = iso => {
    if (!iso) return '';
    const d = new Date(iso), h = new Date();
    if (d.toDateString() === h.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const ontem = new Date(h); ontem.setDate(h.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return 'ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  const dataLonga = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const inicial = n => esc((String(n || '?').trim()[0] || '?').toUpperCase());

  async function api(url, corpo) {
    const r = await fetch(url, corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) } : undefined);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  }

  async function carregarLista() {
    try { lista = await api('/api/direct'); erroLista = ''; } catch (e) { erroLista = e.message; }
    render();
  }
  async function carregarConversa(silencioso) {
    if (!aberta) return;
    const id = aberta.id;
    try {
      const j = await api('/api/direct/mensagens?' + new URLSearchParams({ id: aberta.id, conta: aberta.conta }));
      if (!aberta || aberta.id !== id) return;
      const mudou = !conversa || JSON.stringify(conversa.mensagens) !== JSON.stringify(j.mensagens);
      conversa = j; erroConversa = '';
      if (mudou || !silencioso) render(mudou);
    } catch (e) { if (!silencioso) { erroConversa = e.message; render(); } }
  }

  function abrirConversa(c) {
    if (aberta && aberta.id === c.id) return;
    aberta = c; conversa = null; erroConversa = ''; aviso = '';
    render();
    carregarConversa();
    // não marca como lida ao abrir: no Instagram isso mostra "visto" para a pessoa. Só ao enviar a resposta.
  }

  async function sugerir() {
    if (!aberta || sugerindo) return;
    const id = aberta.id;
    sugerindo = true; aviso = ''; render();
    try {
      const j = await api('/api/direct/sugerir', { id: aberta.id, conta: aberta.conta });
      rascunho[id] = j.texto;
      if (aberta && aberta.id === id) aviso = 'Sugestão da IA. Revise e edite antes de enviar.';
    } catch (e) { aviso = 'Não deu para sugerir: ' + e.message; }
    sugerindo = false; render();
    const caixa = $('#dm-caixa'); if (caixa) { caixa.focus(); caixa.setSelectionRange(caixa.value.length, caixa.value.length); }
  }

  async function enviar() {
    if (!aberta || enviando) return;
    const texto = (rascunho[aberta.id] || '').trim();
    if (!texto) { aviso = 'Escreva a mensagem (ou peça uma sugestão) antes de enviar.'; render(); return; }
    if (!confirm('Enviar para ' + aberta.nome + (aberta.arroba ? ' (@' + aberta.arroba + ')' : '') + ' no direct?\n\n' + texto)) return;
    enviando = true; aviso = ''; render();
    try {
      const j = await api('/api/direct/enviar', { id: aberta.id, conta: aberta.conta, texto });
      rascunho[aberta.id] = '';
      aviso = j.janela === 'humano' ? 'Enviada (fora das 24 h, com a etiqueta de resposta humana).' : 'Enviada.';
      await carregarConversa();
      carregarLista();
    } catch (e) { aviso = 'Não enviou: ' + e.message; }
    enviando = false; render();
  }

  // ---------- desenho ----------
  function itemLista(c) {
    const b = el('button', 'dm-item' + (aberta && aberta.id === c.id ? ' on' : '') + (c.naoLidas ? ' nova' : ''));
    const foto = c.foto ? '<img src="' + esc(c.foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'' + inicial(c.nome) + '\'}))">' : '<span>' + inicial(c.nome) + '</span>';
    b.innerHTML = '<div class="dm-av">' + foto + '</div><div class="dm-item-b"><div class="dm-item-l"><b>' + esc(c.nome) + '</b><span>' + esc(hora(c.quando)) + '</span></div>'
      + '<div class="dm-item-l"><div class="dm-prev">' + esc(c.ultima || '(sem texto)') + '</div>' + (c.naoLidas ? '<i class="dm-n">' + c.naoLidas + '</i>' : '') + '</div></div>';
    b.onclick = () => abrirConversa(c);
    return b;
  }

  function colunaLista() {
    const lado = el('div', 'mc-card dm-lado');
    const topo = el('div', 'dm-lado-top');
    const filtros = el('div', 'dm-filtros');
    [['todas', 'Todas'], ['novas', 'Não lidas' + (lista && lista.naoLidas ? ' · ' + lista.naoLidas : '')]].forEach(([id, t]) => {
      const b = el('button', 'dm-filtro' + (filtro === id ? ' on' : ''), esc(t));
      b.onclick = () => { filtro = id; render(); };
      filtros.appendChild(b);
    });
    topo.appendChild(filtros);
    const inp = el('input', 'dm-busca');
    inp.placeholder = 'Buscar nome ou @';
    inp.value = busca;
    inp.oninput = () => { busca = inp.value; desenharItens(); };
    topo.appendChild(inp);
    lado.appendChild(topo);
    const itens = el('div', 'dm-itens');
    itens.id = 'dm-itens';
    lado.appendChild(itens);
    return lado;
  }
  function desenharItens() {
    const box = $('#dm-itens');
    if (!box) return;
    box.innerHTML = '';
    if (erroLista) { box.appendChild(el('div', 'mc-warn', '<div>&#9888;</div><div>' + esc(erroLista) + '</div>')); return; }
    if (!lista) { box.appendChild(el('div', 'mc-empty', 'lendo as conversas...')); return; }
    const q = busca.trim().toLowerCase().replace(/^@/, '');
    const vis = lista.conversas.filter(c => (filtro === 'todas' || c.naoLidas) && (!q || c.nome.toLowerCase().includes(q) || c.arroba.toLowerCase().includes(q)));
    if (!vis.length) box.appendChild(el('div', 'mc-empty', filtro === 'novas' ? 'nenhuma conversa sem ler' : 'nenhuma conversa'));
    vis.forEach(c => box.appendChild(itemLista(c)));
  }

  function colunaConversa() {
    const dir = el('div', 'mc-card dm-conv');
    if (!aberta) {
      dir.appendChild(el('div', 'dm-escolha', '<b>Escolha uma conversa</b><span>Clique numa conversa à esquerda. Para responder, escreva ou use <b>Sugerir resposta</b>: a IA lê o seu segundo cérebro e propõe o texto na sua voz. Nada é enviado sem você clicar em Enviar.</span>'));
      return dir;
    }
    const cab = el('div', 'dm-cab');
    cab.innerHTML = '<div class="dm-av grande">' + (aberta.foto ? '<img src="' + esc(aberta.foto) + '" alt="" referrerpolicy="no-referrer">' : '<span>' + inicial(aberta.nome) + '</span>') + '</div>'
      + '<div class="dm-cab-b"><b>' + esc(aberta.nome) + '</b><span>' + (aberta.arroba ? '@' + esc(aberta.arroba) + ' · ' : '') + 'Instagram' + (aberta.minhaConta ? ' · para @' + esc(aberta.minhaConta) : '') + '</span></div>'
      + (aberta.url ? '<a class="act" href="' + esc(aberta.url) + '" target="_blank" rel="noopener">Abrir no Instagram ↗</a>' : '');
    dir.appendChild(cab);

    const chat = el('div', 'dm-chat');
    chat.id = 'dm-chat';
    if (erroConversa) chat.appendChild(el('div', 'mc-warn', '<div>&#9888;</div><div>' + esc(erroConversa) + '</div>'));
    else if (!conversa) chat.appendChild(el('div', 'mc-empty', 'lendo a conversa...'));
    else {
      if (!conversa.mensagens.length) chat.appendChild(el('div', 'mc-empty', 'sem mensagens'));
      let diaAnt = '';
      conversa.mensagens.forEach(m => {
        const dia = m.quando ? new Date(m.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '';
        if (dia && dia !== diaAnt) { chat.appendChild(el('div', 'dm-dia', esc(dia))); diaAnt = dia; }
        const extras = [m.story ? 'respondeu ao story' : '', m.anexos.length ? m.anexos.map(a => ({ image: 'foto', video: 'vídeo', audio: 'áudio', share: 'post compartilhado' }[a] || a)).join(', ') : '', m.semConteudo && !m.texto ? 'conteúdo que a API não mostra' : ''].filter(Boolean);
        chat.appendChild(el('div', 'dm-msg ' + (m.de === 'eu' ? 'eu' : 'ela'),
          (m.texto ? '<div class="dm-txt">' + esc(m.texto) + '</div>' : '') + (extras.length ? '<div class="dm-extra">' + esc(extras.join(' · ')) + '</div>' : '')
          + '<div class="dm-hora">' + esc(new Date(m.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) + '</div>'));
      });
    }
    dir.appendChild(chat);

    const comp = el('div', 'dm-comp');
    if (conversa && conversa.janela === 'fechada') comp.appendChild(el('div', 'dm-aviso alerta', 'A última mensagem dessa pessoa tem mais de 7 dias: o Instagram não deixa responder pela API. Responda pelo app.'));
    else if (conversa && conversa.janela === 'humano') comp.appendChild(el('div', 'dm-aviso', 'Passou de 24 h desde a última mensagem dela: a resposta vai como resposta humana (vale até 7 dias).'));
    const caixa = el('textarea', 'dm-caixa');
    caixa.id = 'dm-caixa';
    caixa.rows = 3;
    caixa.maxLength = 1000;
    caixa.placeholder = sugerindo ? 'A IA está lendo a conversa e o seu segundo cérebro...' : 'Escreva a resposta, ou clique em Sugerir resposta';
    caixa.value = rascunho[aberta.id] || '';
    caixa.disabled = sugerindo || enviando;
    caixa.oninput = () => { rascunho[aberta.id] = caixa.value; };
    caixa.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar(); } };
    comp.appendChild(caixa);
    const barra = el('div', 'dm-barra');
    const bSug = el('button', 'act dm-sug', sugerindo ? '✦ Pensando...' : '✦ Sugerir resposta');
    bSug.disabled = sugerindo || enviando || !conversa;
    bSug.onclick = sugerir;
    barra.appendChild(bSug);
    if (aviso) barra.appendChild(el('span', 'dm-msg-aviso' + (/^Não/.test(aviso) ? ' erro' : ''), esc(aviso)));
    const bEnv = el('button', 'act dm-env', enviando ? 'Enviando...' : 'Enviar');
    bEnv.title = 'Enviar (Cmd+Enter)';
    bEnv.disabled = sugerindo || enviando || !conversa || (conversa && conversa.janela === 'fechada');
    bEnv.onclick = enviar;
    barra.appendChild(bEnv);
    comp.appendChild(barra);
    dir.appendChild(comp);
    return dir;
  }

  function render(rolarFim) {
    const inner = $('#dm-inner');
    if (!inner) return;
    const chatAntes = $('#dm-chat');
    const noFim = !chatAntes || chatAntes.scrollHeight - chatAntes.scrollTop - chatAntes.clientHeight < 60;
    const rolagemLista = $('#dm-itens') ? $('#dm-itens').scrollTop : 0;
    const foco = document.activeElement && document.activeElement.id === 'dm-caixa';
    const B = window.BRAND || {};
    inner.innerHTML = '';
    const top = el('div', 'mc-top');
    const back = el('button', 'mc-back', '<span class="mc-back-arrow">&#9666;</span><div><div><span class="mc-back-name">' + esc(B.nome || 'Cara da IA')
      + '</span><span class="mc-back-os">Mensagens</span></div><div class="mc-back-sub">voltar pro grafo do cérebro</div></div>');
    back.onclick = fechar;
    top.appendChild(back);
    const dirTop = el('div', 'mc-top-right');
    const bAt = el('button', 'act', 'Atualizar');
    bAt.onclick = () => { carregarLista(); carregarConversa(); };
    dirTop.appendChild(bAt);
    top.appendChild(dirTop);
    inner.appendChild(top);
    const grade = el('div', 'dm-grade');
    grade.appendChild(colunaLista());
    grade.appendChild(colunaConversa());
    inner.appendChild(grade);
    desenharItens();
    const it = $('#dm-itens'); if (it) it.scrollTop = rolagemLista;
    const chat = $('#dm-chat');
    if (chat && (rolarFim || noFim)) chat.scrollTop = chat.scrollHeight;
    if (foco && $('#dm-caixa') && !$('#dm-caixa').disabled) $('#dm-caixa').focus();
  }

  // ---------- abrir / fechar ----------
  function abrir() {
    if (window.MissionControl) window.MissionControl.close();
    if (window.Gestao) window.Gestao.fechar();
    if (window.Tarefas) window.Tarefas.fechar();
    if (window.LinkedIn) window.LinkedIn.fechar();
    const root = $('#dm-root');
    document.body.classList.add('mc-open', 'dm-open');
    root.classList.add('on');
    window.__mcPaused = true;
    void root.offsetHeight;
    root.classList.add('in');
    render();
    carregarLista();
    if (aberta) carregarConversa();
    clearInterval(timerConversa); clearInterval(timerLista);
    timerConversa = setInterval(() => { if (!document.hidden) carregarConversa(true); }, 20000);
    timerLista = setInterval(() => { if (!document.hidden) carregarLista(); }, 60000);
  }
  function fechar() {
    const root = $('#dm-root');
    if (!root.classList.contains('on')) return;
    clearInterval(timerConversa); clearInterval(timerLista);
    root.classList.remove('in');
    document.body.classList.remove('dm-open');
    if (!document.querySelector('#mc-root.on') && !document.querySelector('#gs-root.on') && !document.querySelector('#tf-root.on') && !document.querySelector('#li-root.on')) { document.body.classList.remove('mc-open'); window.__mcPaused = false; }
    setTimeout(() => root.classList.remove('on'), 240);
  }
  const estaAberta = () => $('#dm-root').classList.contains('on');

  addEventListener('DOMContentLoaded', () => {
    const root = el('div');
    root.id = 'dm-root';
    root.innerHTML = '<div id="dm-scroll"><div id="dm-inner"></div></div>';
    document.body.appendChild(root);
    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (e.key === 'Escape' && estaAberta()) {
        const drawer = document.getElementById('brain-viewer');
        if (drawer && drawer.classList.contains('open')) return;
        e.stopPropagation(); e.preventDefault(); fechar(); return;
      }
      if (!digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'd' || e.key === 'D') && !document.querySelector('#ea-root.on')) {
        e.preventDefault(); e.stopPropagation(); estaAberta() ? fechar() : abrir();
      }
    }, true);
  });

  window.Mensagens = { abrir, fechar };
})();
