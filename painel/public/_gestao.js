/* _gestao.js - tela Gestão (tecla G): os números da operação num lugar só, sem sair do painel.

   Um fetch em /api/gestao (só leitura). Cada card abre o detalhe embaixo, dentro da própria
   tela: cobranças, propostas, WhatsApp (conversas e mensagens), clientes, agenda e tarefas.
   Nada aqui envia, cria ou altera algo: enviar e cobrar continuam com prévia e confirmação. */
'use strict';
(function () {
  let dados = null;
  let aberto = null;      // card cujo detalhe está aberto
  let carregando = false;

  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const ddmm = iso => iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) : '';
  const hora = ms => ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const viewer = rel => { if (window.BrainCore && rel) window.BrainCore.openViewer(rel); };

  async function api(caminho) {
    const r = await fetch(caminho, { headers: { 'Content-Type': 'application/json' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  // ---------- cards ----------
  function falha(b) { return !b || !b.ok; }
  function cards() {
    const d = dados, out = [];
    const c = d.cobrancas;
    out.push(falha(c)
      ? { id: 'cobrancas', titulo: 'Cobranças', grande: '--', sub: c && c.erro || 'Asaas indisponível', alerta: true }
      : { id: 'cobrancas', titulo: 'Cobranças', grande: brl(c.aVencer.total), sub: c.aVencer.itens.length + ' a vencer · ' + c.vencidas.itens.length + ' vencida(s)',
          alerta: c.vencidas.itens.length > 0, extra: 'recebido em 30 dias: ' + brl(c.recebidas.total) });
    const p = d.propostas;
    out.push(falha(p)
      ? { id: 'propostas', titulo: 'Propostas', grande: '--', sub: p && p.erro || 'indisponível', alerta: true }
      : { id: 'propostas', titulo: 'Propostas', grande: String(p.pendentes.length), sub: 'esperando o seu ok',
          alerta: p.pendentes.some(x => x.parado), extra: p.enviadasNoMes + ' enviada(s) no mês · ' + p.enviadas30d + ' em 30 dias' });
    const w = d.whatsapp;
    out.push(falha(w)
      ? { id: 'whatsapp', titulo: 'WhatsApp', grande: '--', sub: w && w.erro || 'indisponível', alerta: true }
      : { id: 'whatsapp', titulo: 'WhatsApp', grande: String(w.naoLidas), sub: 'conversa(s) com mensagem não lida',
          alerta: !w.conectado, extra: w.conectado ? 'conectado' + (w.perfil ? ' · ' + w.perfil : '') : 'DESCONECTADO' });
    const cl = d.clientes;
    if (!falha(cl)) {
      const velhos = cl.ativos.filter(x => x.velho).length;
      out.push({ id: 'clientes', titulo: 'Clientes', grande: String(cl.ativos.length), sub: 'ativos · ' + cl.prospects.length + ' prospect(s)',
        alerta: velhos > 0, extra: velhos ? velhos + ' com estado velho (mais de 14 dias)' : 'estados em dia' });
    }
    const b = d.brief;
    if (!falha(b)) out.push({ id: 'agenda', titulo: 'Hoje', grande: String(b.agenda.length), sub: 'compromisso(s) · ' + b.emails.length + ' e-mail(s) pedindo resposta',
      extra: b.geradoEm ? 'resumo das ' + String(b.geradoEm).slice(11, 16) : 'sem resumo da manhã ainda' });
    const t = d.tarefas;
    if (!falha(t)) out.push({ id: 'tarefas', titulo: 'Tarefas', grande: String(t.abertas), sub: 'abertas no Mission Control',
      alerta: t.atrasadas > 0, extra: t.atrasadas + ' atrasada(s) · ' + t.paraHoje + ' para hoje' });
    return out;
  }

  // ---------- detalhes ----------
  function linha(tempo, titulo, sub, attrs, cls) {
    return '<div class="mc-row gs-linha' + (attrs ? ' gs-click' : '') + '"' + (attrs || '') + '>'
      + '<div class="mc-row-time' + (cls || '') + '">' + esc(tempo) + '</div>'
      + '<div class="mc-row-main"><div class="mc-row-t">' + titulo + '</div>' + (sub ? '<div class="mc-row-s">' + sub + '</div>' : '') + '</div></div>';
  }
  const vazio = t => '<div class="mc-empty">' + esc(t) + '</div>';
  const grupo = (titulo, corpo) => '<div class="mc-cob-sec"><div class="mc-cob-h">' + titulo + '</div>' + corpo + '</div>';

  function detalhe(id) {
    const d = dados;
    if (id === 'cobrancas') {
      const c = d.cobrancas;
      if (falha(c)) return vazio(c && c.erro || 'Asaas indisponível');
      const item = (p, q) => linha(q, esc(p.cliente) + ' · ' + brl(p.value), esc(p.description || '(sem descrição)') + ' · ' + esc(p.billingType)
        + (p.invoiceUrl ? ' · <a href="' + esc(p.invoiceUrl) + '" target="_blank" rel="noopener">fatura</a>' : ''), '', q.includes('dia') ? ' late' : '');
      const atraso = p => { const n = Math.round((Date.now() - Date.parse(p.dueDate + 'T12:00:00')) / 864e5); return n + (n === 1 ? ' dia' : ' dias'); };
      return grupo('Vencidas e não pagas <span>' + c.vencidas.itens.length + ' · ' + brl(c.vencidas.total) + '</span>', c.vencidas.itens.map(p => item(p, atraso(p))).join('') || vazio('nenhuma'))
        + grupo('A vencer <span>' + c.aVencer.itens.length + ' · ' + brl(c.aVencer.total) + '</span>', c.aVencer.itens.map(p => item(p, ddmm(p.dueDate))).join('') || vazio('nenhuma'))
        + grupo('Recebidas nos últimos 30 dias <span>' + c.recebidas.itens.length + ' · ' + brl(c.recebidas.total) + '</span>', c.recebidas.itens.map(p => item(p, ddmm(p.paymentDate || p.dueDate))).join('') || vazio('nenhuma'))
        + '<div class="mc-modal-act"><button class="act" data-acao="nova-cobranca">Nova cobrança</button></div>';
    }
    if (id === 'propostas') {
      const p = d.propostas;
      if (falha(p)) return vazio(p && p.erro || 'indisponível');
      const pend = p.pendentes.map(x => linha(ddmm(x.pedidoEm), esc(x.cliente) + (x.parado ? ' · <b class="gs-alerta">parada</b>' : ''),
        (x.rascunho ? 'rascunho sem PDF' : esc(x.pdf.split('/').pop())) + ' · ' + esc(x.mensagem.split('\n')[0] || ''), ' data-nota="' + esc(x.arquivoNota) + '"', x.parado ? ' late' : '')).join('');
      const env = p.enviadas.map(x => linha(ddmm(x.enviadoEm), esc(x.cliente), 'enviada pelo WhatsApp · ' + esc(x.pdf.split('/').pop() || ''), ' data-nota="' + esc(x.arquivoNota) + '"')).join('');
      return grupo('Esperando o seu ok <span>' + p.pendentes.length + '</span>', pend || vazio('nenhuma: peça uma proposta ao Claude'))
        + grupo('Enviadas <span>' + p.enviadasNoMes + ' no mês</span>', env || vazio('nenhuma registrada ainda'))
        + '<div class="mc-form-note">Para enviar uma proposta pendente, diga "pode mandar" no Claude: o painel só mostra.</div>';
    }
    if (id === 'whatsapp') {
      const w = d.whatsapp;
      if (falha(w)) return vazio(w && w.erro || 'indisponível');
      const conv = w.conversas.map(c => linha(hora(c.ultima), esc(c.nome || c.numero) + (c.naoLidas ? ' · <b class="gs-alerta">' + c.naoLidas + ' não lida(s)</b>' : ''),
        esc(c.numero), ' data-chat="' + esc(c.chatid) + '" data-nome="' + esc(c.nome || c.numero) + '"')).join('');
      return grupo('Conversas recentes <span>' + (w.conectado ? 'conectado' : 'desconectado') + '</span>', conv || vazio('nenhuma conversa'))
        + '<div id="gs-msgs"></div>'
        + '<div class="mc-form-note">Só leitura. Para responder, peça ao Claude: ele mostra a prévia e envia depois do seu "pode mandar".</div>';
    }
    if (id === 'clientes') {
      const cl = d.clientes;
      return grupo('Ativos <span>' + cl.ativos.length + '</span>', cl.ativos.map(c => linha(c.atualizado ? ddmm(c.atualizado) : '--', esc(c.nome) + (c.velho ? ' · <b class="gs-alerta">estado velho</b>' : ''),
          esc(c.resumo), ' data-nota="' + esc(c.nota) + '"', c.velho ? ' late' : '')).join('') || vazio('nenhum'))
        + grupo('Prospects <span>' + cl.prospects.length + '</span>', cl.prospects.map(c => linha('', esc(c.nome), esc(c.resumo), ' data-nota="' + esc(c.nota) + '"')).join('') || vazio('nenhum'));
    }
    if (id === 'agenda') {
      const b = d.brief;
      return grupo('Agenda de hoje <span>' + b.agenda.length + '</span>', b.agenda.map(a => linha(a.time, esc(a.title), esc(a.kind || ''))).join('') || vazio('nada na agenda (ou o resumo da manhã ainda não rodou)'))
        + grupo('E-mails pedindo resposta <span>' + b.emails.length + '</span>', b.emails.map(e => linha('', esc(e.subject), esc(e.from) + (e.why ? ' · ' + esc(e.why) : ''))).join('') || vazio('nenhum'))
        + grupo('Follow-ups <span>' + b.followups.length + '</span>', b.followups.map(f => linha(ddmm(f.due), esc(f.deal), esc((f.contact || {}).email || ''))).join('') || vazio('nenhum'));
    }
    if (id === 'tarefas') {
      return vazio('As tarefas ficam no Mission Control.') + '<div class="mc-modal-act"><button class="act" data-acao="mission">Abrir o Mission Control</button></div>';
    }
    return '';
  }

  async function abrirConversa(chatid, nome) {
    const box = $('#gs-msgs');
    if (!box) return;
    box.innerHTML = vazio('lendo a conversa...');
    try {
      const j = await api('/api/gestao/whatsapp?chatid=' + encodeURIComponent(chatid));
      box.innerHTML = grupo(esc(nome) + ' <span>últimas ' + j.mensagens.length + '</span>',
        j.mensagens.map(m => '<div class="gs-msg' + (m.eu ? ' eu' : '') + '"><div class="gs-msg-h">' + esc(m.quem) + ' · ' + esc(hora(m.quando)) + '</div>'
          + '<div class="gs-msg-t">' + esc(m.texto).replace(/\n/g, '<br>') + '</div></div>').join('') || vazio('sem mensagens'));
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { box.innerHTML = vazio(e.message); }
  }

  // ---------- render ----------
  function render() {
    const inner = $('#gs-inner');
    if (!inner) return;
    const B = window.BRAND || {};
    inner.innerHTML = '';
    const top = el('div', 'mc-top');
    const back = el('button', 'mc-back', '<span class="mc-back-arrow">&#9666;</span><div><div><span class="mc-back-name">' + esc(B.nome || 'Cara da IA')
      + '</span><span class="mc-back-os">Gestão</span></div><div class="mc-back-sub">voltar pro grafo do cérebro</div></div>');
    back.onclick = fechar;
    top.appendChild(back);
    const dir = el('div', 'mc-top-right');
    const bAt = el('button', 'act', carregando ? 'Atualizando...' : 'Atualizar');
    bAt.onclick = carregar;
    const bMc = el('button', 'act', 'Mission Control');
    bMc.onclick = () => { fechar(); window.MissionControl && window.MissionControl.open(); };
    dir.appendChild(bMc); dir.appendChild(bAt);
    if (dados) dir.appendChild(el('div', 'mc-clock', '<div class="mc-clock-d">' + esc(String(dados.geradoEm).slice(11, 16)) + '</div><div class="mc-clock-s">lido agora</div>'));
    top.appendChild(dir);
    inner.appendChild(top);

    if (!dados) { inner.appendChild(el('div', 'mc-empty', 'lendo as fontes...')); return; }

    const grid = el('div', 'gs-grid');
    for (const c of cards()) {
      const b = el('button', 'gs-card' + (aberto === c.id ? ' on' : '') + (c.alerta ? ' alerta' : ''));
      b.innerHTML = '<div class="gs-card-t">' + esc(c.titulo) + '</div><div class="gs-card-n">' + esc(c.grande) + '</div>'
        + '<div class="gs-card-s">' + esc(c.sub) + '</div>' + (c.extra ? '<div class="gs-card-x">' + esc(c.extra) + '</div>' : '');
      b.onclick = () => { aberto = aberto === c.id ? null : c.id; render(); };
      grid.appendChild(b);
    }
    inner.appendChild(grid);

    if (aberto) {
      const det = el('div', 'mc-card gs-det', detalhe(aberto));
      det.querySelectorAll('[data-nota]').forEach(n => n.onclick = () => viewer(n.dataset.nota));
      det.querySelectorAll('[data-chat]').forEach(n => n.onclick = () => abrirConversa(n.dataset.chat, n.dataset.nome));
      det.querySelectorAll('[data-acao]').forEach(n => n.onclick = () => {
        const MC = window.MissionControl;
        if (!MC) return;
        fechar();
        if (n.dataset.acao === 'mission') MC.open();
        if (n.dataset.acao === 'nova-cobranca') { MC.open(); MC.openCobranca(); }
      });
      inner.appendChild(det);
    }
  }

  async function carregar() {
    carregando = true; render();
    try { dados = await api('/api/gestao'); }
    catch (e) { dados = null; const i = $('#gs-inner'); if (i) i.appendChild(el('div', 'mc-warn', '<div>&#9888;</div><div>' + esc(e.message) + '</div>')); }
    carregando = false; render();
  }

  // ---------- abrir / fechar ----------
  function abrir(secao) {
    if (window.MissionControl) window.MissionControl.close();
    const root = $('#gs-root');
    document.body.classList.add('mc-open', 'gs-open');
    root.classList.add('on');
    window.__mcPaused = true;
    void root.offsetHeight;
    root.classList.add('in');
    if (secao) aberto = secao;
    render();
    carregar();
  }
  function fechar() {
    const root = $('#gs-root');
    if (!root.classList.contains('on')) return;
    root.classList.remove('in');
    document.body.classList.remove('gs-open');
    if (!document.querySelector('#mc-root.on')) { document.body.classList.remove('mc-open'); window.__mcPaused = false; }
    setTimeout(() => root.classList.remove('on'), 240);
  }
  const estaAberta = () => $('#gs-root').classList.contains('on');

  addEventListener('DOMContentLoaded', () => {
    const root = el('div');
    root.id = 'gs-root';
    root.innerHTML = '<div id="gs-scroll"><div id="gs-inner"></div></div>';
    document.body.appendChild(root);
    const fab = el('button', 'fab', '▦ GESTÃO');
    fab.id = 'fab-gestao';
    fab.onclick = () => estaAberta() ? fechar() : abrir();
    document.body.appendChild(fab);
    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape' && estaAberta()) {
        const drawer = document.getElementById('brain-viewer');
        if (drawer && drawer.classList.contains('open')) return;
        e.stopPropagation(); e.preventDefault(); fechar(); return;
      }
      if (!digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault(); e.stopPropagation(); estaAberta() ? fechar() : abrir();
      }
    }, true);
  });

  window.Gestao = { abrir, fechar };
})();
