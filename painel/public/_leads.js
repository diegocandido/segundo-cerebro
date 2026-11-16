/* _leads.js - tela Leads (tecla P): o funil dos prospects e quem tocar hoje.

   Um fetch em /api/leads (só leitura, pelo bin/leads.py do OS). Registrar um toque, mudar a etapa
   ou criar lead continua pelo Claude ("registra o toque nesse lead"), depois do ok para a mensagem. */
'use strict';
(function () {
  let dados = null, erro = '', carregando = false, verFechados = false;
  const abertos = new Set();
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const br = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '-';
  const ATIVAS = ['agendado', 'nao-compareceu', 'reuniao-feita', 'proposta-enviada', 'negociando'];
  const CANAL = { email: 'e-mail', whatsapp: 'WhatsApp', reuniao: 'reunião', ligacao: 'ligação', linkedin: 'LinkedIn', outro: 'nota' };

  function prazo(l) {
    const n = l.dias_para_proximo;
    if (!l.aberto) return '';
    if (n == null) return '<span class="tf-tag atrasada">sem próximo contato</span>';
    if (n < 0) return '<span class="tf-tag atrasada">atrasado ' + (-n) + ' dia' + (n === -1 ? '' : 's') + '</span>';
    if (n === 0) return '<span class="tf-tag hoje">tocar hoje</span>';
    return '<span class="tf-tag">próximo ' + br(l.proximo_contato) + (n <= 7 ? ' · em ' + n + ' dia' + (n === 1 ? '' : 's') : '') + '</span>';
  }

  function contato(l) {
    const w = (l.whatsapp || '').replace(/\D/g, '');
    return (w ? '<a href="https://wa.me/' + esc(w) + '" target="_blank" rel="noopener">WhatsApp ↗</a>' : '')
      + (l.email ? '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>' : '');
  }

  function cartao(l) {
    const aberto = abertos.has(l.slug);
    const hist = l.contatos.slice().reverse().map(c => '<li><b>' + br(c.data) + '</b> · ' + esc(CANAL[c.canal] || c.canal) + ' · ' + esc(c.nota) + '</li>').join('');
    const c = el('div', 'tf-card ld-card' + (aberto ? ' aberto' : ''),
      '<div class="tf-card-main"><div class="tf-card-t"><b>' + esc(l.nome) + '</b></div>'
      + (l.proximo_passo && l.aberto ? '<div class="ld-passo">' + esc(l.proximo_passo) + '</div>' : '')
      + '<div class="tf-card-m">' + prazo(l) + '<span class="tf-tag">último ' + br(l.ultimo_contato) + '</span>'
      + (l.origem ? '<span class="tf-tag">' + esc(l.origem) + '</span>' : '') + (!l.aberto ? '<span class="tf-tag">' + esc(l.rotulo) + '</span>' : '') + '</div>'
      + (aberto ? '<div class="ld-det">' + (l.resumo ? '<div class="ld-resumo">' + esc(l.resumo) + '</div>' : '')
        + '<div class="li-metr">' + contato(l) + '<span>' + esc(l.arquivo) + '</span></div>'
        + '<div class="ld-hist-h">Contatos</div><ul class="ld-hist">' + (hist || '<li>nenhum registrado</li>') + '</ul></div>' : '')
      + '</div>');
    c.onclick = e => { if (e.target.closest('a')) return; aberto ? abertos.delete(l.slug) : abertos.add(l.slug); render(); };
    return c;
  }

  function render() {
    const inner = $('#ld-inner');
    if (!inner) return;
    const B = window.BRAND || {};
    inner.innerHTML = '';
    const top = el('div', 'mc-top');
    const back = el('button', 'mc-back', '<span class="mc-back-arrow">&#9666;</span><div><div><span class="mc-back-name">' + esc(B.nome || 'Cara da IA')
      + '</span><span class="mc-back-os">Leads</span></div><div class="mc-back-sub">voltar pro grafo do cérebro</div></div>');
    back.onclick = fechar;
    top.appendChild(back);
    const dir = el('div', 'mc-top-right');
    const bAt = el('button', 'act', carregando ? 'Atualizando...' : 'Atualizar');
    bAt.onclick = carregar;
    dir.appendChild(bAt);
    top.appendChild(dir);
    inner.appendChild(top);

    if (erro) { inner.appendChild(el('div', 'mc-warn', '<div>&#9888;</div><div>' + esc(erro) + '</div>')); return; }
    if (!dados) { inner.appendChild(el('div', 'mc-empty', 'lendo os leads...')); return; }

    const ls = dados.leads;
    const ativos = ls.filter(l => l.aberto);
    const tocar = ativos.filter(l => l.dias_para_proximo == null || l.dias_para_proximo <= 0)
      .sort((a, b) => (a.dias_para_proximo ?? -999) - (b.dias_para_proximo ?? -999));
    const semana = ativos.filter(l => l.dias_para_proximo > 0 && l.dias_para_proximo <= 7);
    const fechou = ls.filter(l => l.etapa === 'fechou'), perdido = ls.filter(l => l.etapa === 'perdido');
    const atrasados = tocar.filter(l => l.dias_para_proximo == null || l.dias_para_proximo < 0).length;

    const cards = [
      { t: 'Leads ativos', n: ativos.length, s: ativos.filter(l => l.etapa === 'proposta-enviada' || l.etapa === 'negociando').length + ' com proposta ou negociando' },
      { t: 'Tocar hoje', n: tocar.length, s: atrasados ? atrasados + ' atrasado(s) ou sem data' : tocar.length ? 'todos em dia' : 'nada para hoje', alerta: atrasados > 0 },
      { t: 'Próximos 7 dias', n: semana.length, s: semana[0] ? 'próximo: ' + semana.sort((a, b) => a.dias_para_proximo - b.dias_para_proximo)[0].nome.split(' (')[0] + ' em ' + br(semana[0].proximo_contato) : 'agenda livre' },
      { t: 'Fechou · Perdido', n: fechou.length + ' · ' + perdido.length, s: 'histórico guardado nas notas' },
    ];
    const grid = el('div', 'gs-grid');
    for (const k of cards) grid.appendChild(el('div', 'gs-card li-card' + (k.alerta ? ' alerta' : ''), '<div class="gs-card-t">' + esc(k.t) + '</div><div class="gs-card-n">' + esc(k.n) + '</div><div class="gs-card-s">' + esc(k.s) + '</div>'));
    inner.appendChild(grid);

    if (tocar.length) {
      const sec = el('div', 'ld-sec');
      sec.appendChild(el('div', 'tf-col-h', 'Tocar hoje <span>' + tocar.length + '</span>'));
      const lista = el('div', 'ld-hoje');
      tocar.forEach(l => lista.appendChild(cartao(l)));
      sec.appendChild(lista);
      inner.appendChild(sec);
    }

    const board = el('div', 'tf-board ld-board');
    for (const et of ATIVAS) {
      const grupo = ativos.filter(l => l.etapa === et).sort((a, b) => (a.dias_para_proximo ?? -999) - (b.dias_para_proximo ?? -999));
      const rot = (dados.etapas.find(e => e.id === et) || {}).rotulo || et;
      const col = el('div', 'tf-col', '<div class="tf-col-h">' + esc(rot) + ' <span>' + grupo.length + '</span></div>');
      const corpo = el('div', 'tf-col-b');
      grupo.forEach(l => corpo.appendChild(cartao(l)));
      if (!grupo.length) corpo.appendChild(el('div', 'ld-vazio', '-'));
      col.appendChild(corpo);
      board.appendChild(col);
    }
    const semEtapa = ativos.filter(l => !ATIVAS.includes(l.etapa));
    if (semEtapa.length) {
      const col = el('div', 'tf-col', '<div class="tf-col-h">Sem etapa <span>' + semEtapa.length + '</span></div>');
      const corpo = el('div', 'tf-col-b'); semEtapa.forEach(l => corpo.appendChild(cartao(l))); col.appendChild(corpo); board.appendChild(col);
    }
    inner.appendChild(board);

    const fech = fechou.concat(perdido);
    if (fech.length) {
      const b = el('button', 'act ld-toggle', (verFechados ? 'Esconder' : 'Ver') + ' fechados e perdidos (' + fech.length + ')');
      b.onclick = () => { verFechados = !verFechados; render(); };
      inner.appendChild(b);
      if (verFechados) {
        const lista = el('div', 'ld-hoje ld-fechados');
        fech.forEach(l => lista.appendChild(cartao(l)));
        inner.appendChild(lista);
      }
    }

    inner.appendChild(el('div', 'mc-form-note', 'Cada lead é uma nota em ' + esc(dados.pasta || 'prospects') + '/, mantida pelo bin/leads.py. Com o Cal.com ligado, as reservas novas viram lead sozinhas no ritual da manhã. '
      + 'Para registrar um contato, mudar a etapa ou dar um lead como perdido, peça ao Claude ("registra o toque nesse lead", "esse lead fechou"). Clique num cartão para ver o histórico.'));
  }

  async function carregar() {
    carregando = true; erro = ''; render();
    try {
      const r = await fetch('/api/leads', { headers: { 'Content-Type': 'application/json' } });
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
    if (window.LinkedIn) window.LinkedIn.fechar();
    const root = $('#ld-root');
    document.body.classList.add('mc-open', 'ld-open');
    root.classList.add('on');
    window.__mcPaused = true;
    void root.offsetHeight;
    root.classList.add('in');
    render();
    carregar();
  }
  function fechar() {
    const root = $('#ld-root');
    if (!root || !root.classList.contains('on')) return;
    root.classList.remove('in');
    document.body.classList.remove('ld-open');
    if (!document.querySelector('#mc-root.on, #gs-root.on, #tf-root.on, #li-root.on')) { document.body.classList.remove('mc-open'); window.__mcPaused = false; }
    setTimeout(() => root.classList.remove('on'), 240);
  }
  const estaAberta = () => $('#ld-root').classList.contains('on');

  addEventListener('DOMContentLoaded', () => {
    const root = el('div');
    root.id = 'ld-root';
    root.innerHTML = '<div id="ld-scroll"><div id="ld-inner"></div></div>';
    document.body.appendChild(root);
    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (e.key === 'Escape' && estaAberta()) { e.stopPropagation(); e.preventDefault(); fechar(); return; }
      if (!digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault(); e.stopPropagation(); estaAberta() ? fechar() : abrir();
      }
    }, true);
  });

  window.Leads = { abrir, fechar };
})();
