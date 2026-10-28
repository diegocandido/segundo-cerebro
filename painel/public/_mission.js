/* _mission.js - Mission Control: a tela de comando do OS.

   Vive fora do engine do grafo de proposito. O unico ponto de contato com o
   _core.js e o objeto publico window.BrainCore, que ja expoe tudo que a gente
   precisa: openViewer (abrir a nota no viewer que ja existe), jumpTo (saltar
   pro no do cliente no grafo) e S.skin (pra reusar o fundo hexagonal).

   Fluxo: FAB -> overlay -> um fetch em /api/mission -> render dos 3 blocos.
*/
'use strict';
(function () {
  const API = '/api/mission';
  let data = { mission: null, todos: [], meta: {} };
  let showDone = false;
  let loaded = false;

  // ---------- util ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const nfInt = new Intl.NumberFormat('pt-BR');
  function todayISO() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  }
  function fmtDue(due) {
    if (!due) return '';
    const t = todayISO(), diff = daysBetween(t, due);
    if (diff < 0) return diff === -1 ? 'venceu ontem' : 'atrasada ' + Math.abs(diff) + 'd';
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'amanhã';
    if (diff <= 7) return 'em ' + diff + 'd';
    return due.slice(8, 10) + '/' + due.slice(5, 7);
  }

  // no brief o prazo mora numa coluna estreita: forma curta pra caber numa linha,
  // e a cor carrega o resto do recado (fmtDue continua servindo os chips do to-do).
  function briefDue(due) {
    if (!due) return { text: '--', cls: '' };
    const diff = daysBetween(todayISO(), due);
    if (diff < 0) return { text: '-' + Math.abs(diff) + 'd', cls: ' late' };
    if (diff === 0) return { text: 'hoje', cls: ' today' };
    if (diff === 1) return { text: 'amanhã', cls: '' };
    if (diff <= 7) return { text: 'em ' + diff + 'd', cls: '' };
    return { text: due.slice(8, 10) + '/' + due.slice(5, 7), cls: '' };
  }

  function toast(msg, isErr) {
    let t = $('#mc-toast');
    if (!t) { t = el('div', 'mc-toast'); t.id = 'mc-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'mc-toast on' + (isErr ? ' err' : '');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.className = 'mc-toast' + (isErr ? ' err' : ''); }, 2600);
  }

  async function api(method, path, body) {
    const opt = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opt.body = JSON.stringify(body);
    const r = await fetch(path, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  // ---------- fundo: o mesmo hexagonal do grafo ----------
  function paintBackdrop() {
    const c = $('#mc-bg');
    if (!c) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    // janela oculta/minimizada reporta 0x0: nao pinta agora, repinta quando voltar
    if (W < 2 || H < 2) return;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const core = window.BrainCore;
    // reusa o backdrop do skin, pra tela nova pertencer ao mesmo mundo visual
    if (core && core.S && core.S.skin && core.S.skin.drawBackdrop) {
      try { core.S.skin.drawBackdrop(g, W, H, core.S); return; }
      catch (e) { /* cai no fallback */ }
    }
    g.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg') || '#0B0C16';
    g.fillRect(0, 0, W, H);
  }

  // ---------- Morning Brief ----------
  function briefSection(title, rows) {
    const sec = el('div', 'mc-brief-sec');
    sec.appendChild(el('div', 'mc-brief-h', esc(title)));
    if (!rows.length) { sec.appendChild(el('div', 'mc-empty', 'nada por aqui')); return sec; }
    for (const r of rows) sec.appendChild(r);
    return sec;
  }

  function renderBrief(m) {
    const card = el('div', 'mc-card');

    const agenda = (m.brief.agenda || []).map(a => {
      const row = el('div', 'mc-row');
      row.innerHTML = '<div class="mc-row-time">' + esc(a.time || '--') + '</div>'
        + '<div class="mc-row-main"><div class="mc-row-t">' + esc(a.title || '') + '</div>'
        + (a.kind ? '<div class="mc-row-s">' + esc(a.kind) + '</div>' : '') + '</div>';
      return row;
    });

    const fups = (m.brief.followups || []).map(f => {
      const row = el('div', 'mc-row');
      const c = f.contact || {};
      const bits = [];
      if (f.stage) bits.push(esc(f.stage));
      if (f.value) bits.push('R$ ' + nfInt.format(f.value));
      if (c.email) bits.push('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
      if (c.phone) bits.push(esc(c.phone));
      const d = briefDue(f.due);
      row.innerHTML = '<div class="mc-row-time' + d.cls + '" title="' + esc(fmtDue(f.due)) + '">' + esc(d.text) + '</div>'
        + '<div class="mc-row-main"><div class="mc-row-t">' + esc(f.deal || '') + '</div>'
        + (bits.length ? '<div class="mc-row-s">' + bits.join(' · ') + '</div>' : '') + '</div>';
      return row;
    });

    const mails = (m.brief.emails || []).filter(e => e.subject || e.from).map(e => {
      const row = el('div', 'mc-row');
      row.innerHTML = '<div class="mc-row-main"><div class="mc-row-t">' + esc(e.subject || '(sem assunto)') + '</div>'
        + '<div class="mc-row-s">' + esc(e.from || '') + (e.why ? ' · ' + esc(e.why) : '') + '</div></div>';
      return row;
    });

    const parei = (m.brief.onde_parei || []).map(t => {
      const row = el('div', 'mc-row');
      row.innerHTML = '<div class="mc-row-main"><div class="mc-row-t">' + esc(t) + '</div></div>';
      return row;
    });

    card.appendChild(briefSection('Agenda de hoje', agenda));
    card.appendChild(briefSection('Follow-ups', fups));
    card.appendChild(briefSection('E-mails que pedem resposta', mails));
    card.appendChild(briefSection('Onde parei', parei));
    return card;
  }

  // ---------- To-do ----------
  function laneOf(t) {
    if (t.status === 'done') return 'done';
    if (t.status === 'snoozed') return 'snoozed';
    if (!t.due) return 'noDate';
    const d = daysBetween(todayISO(), t.due);
    if (d < 0) return 'late';
    if (d === 0) return 'today';
    if (d <= 7) return 'week';
    return 'later';
  }

  function todoRow(t) {
    const row = el('div', 'mc-todo' + (t.status === 'done' ? ' done' : '') + (t.needs_review ? ' review' : ''));

    const chk = el('button', 'mc-check' + (t.status === 'done' ? ' on' : ''));
    chk.title = t.status === 'done' ? 'reabrir' : 'concluir';
    chk.onclick = () => patch(t.id, { status: t.status === 'done' ? 'open' : 'done' });
    row.appendChild(chk);

    const body = el('div', 'mc-todo-body');
    body.appendChild(el('div', 'mc-todo-t', esc(t.title)));

    const meta = el('div', 'mc-todo-meta');

    // chip de origem: a porta pro contexto no cerebro
    const o = t.origin || {};
    if (o.label) {
      const canOpen = !!o.note_path;
      const chip = el('button', 'mc-chip src-' + t.source + (canOpen ? ' act' : ''), esc(o.label));
      if (canOpen) {
        chip.title = 'abrir ' + o.note_path;
        chip.onclick = () => {
          if (window.BrainCore && BrainCore.openViewer) BrainCore.openViewer(o.note_path);
          else toast('viewer indisponível', true);
        };
      }
      meta.appendChild(chip);
    }

    // chip do cliente: fecha o painel e salta pro no dele no grafo
    if (o.client) {
      const chip = el('button', 'mc-chip client act', esc(o.client));
      chip.title = 'ver ' + o.client + ' no grafo';
      chip.onclick = () => {
        close();
        setTimeout(() => {
          if (window.BrainCore && BrainCore.jumpTo) BrainCore.jumpTo('clientes/' + o.client);
        }, 260);
      };
      meta.appendChild(chip);
    }

    if (t.due) {
      const d = daysBetween(todayISO(), t.due);
      const cls = d < 0 ? ' due-late' : d === 0 ? ' due-today' : '';
      meta.appendChild(el('span', 'mc-chip' + cls, esc(fmtDue(t.due))));
    }
    if (t.status === 'snoozed' && t.snooze_until) {
      meta.appendChild(el('span', 'mc-chip', 'adiada p/ ' + esc(fmtDue(t.snooze_until))));
    }
    if (t.needs_review) {
      const chip = el('span', 'mc-chip rev', 'extraída por IA');
      chip.title = 'veio de extração automática, confira antes de confiar';
      meta.appendChild(chip);
    }
    if (meta.childNodes.length) body.appendChild(meta);
    row.appendChild(body);

    const acts = el('div', 'mc-todo-acts');
    if (t.status !== 'done') {
      const snooze = el('button', 'mc-icon-btn', '&rsaquo;&rsaquo;');
      snooze.title = 'adiar pra amanhã';
      snooze.onclick = () => {
        const d = new Date(); d.setDate(d.getDate() + 1);
        patch(t.id, { snooze_until: d.toISOString().slice(0, 10) });
      };
      acts.appendChild(snooze);
    }
    const del = el('button', 'mc-icon-btn danger', '&times;');
    del.title = t.needs_review ? 'isso não é tarefa, descartar' : 'descartar';
    del.onclick = () => remove(t.id);
    acts.appendChild(del);
    row.appendChild(acts);

    return row;
  }

  function renderTodos(todos) {
    const card = el('div', 'mc-card');

    // captura rapida
    const add = el('div', 'mc-add');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'Adicionar tarefa e pressionar Enter';
    input.id = 'mc-add-input';
    const btn = el('button', null, 'ADD');
    const submit = async () => {
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      try { await api('POST', '/api/todo', { title: v, due: todayISO() }); await load(); toast('tarefa criada'); }
      catch (e) { toast(e.message, true); input.value = v; }
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') { e.stopPropagation(); input.blur(); }
    });
    btn.onclick = submit;
    add.appendChild(input); add.appendChild(btn);
    card.appendChild(add);

    const lanes = { late: [], today: [], week: [], later: [], noDate: [], snoozed: [], done: [] };
    for (const t of todos) lanes[laneOf(t)].push(t);

    const order = [
      ['late', 'Atrasadas', true],
      ['today', 'Hoje', false],
      ['week', 'Esta semana', false],
      ['later', 'Depois', false],
      ['noDate', 'Sem prazo', false],
      ['snoozed', 'Adiadas', false],
    ];

    let anyOpen = false;
    for (const [key, label, hot] of order) {
      const list = lanes[key];
      if (!list.length) continue;
      anyOpen = true;
      const h = el('div', 'mc-lane-h' + (hot ? ' hot' : ''));
      h.innerHTML = esc(label) + '<span class="mc-count">' + list.length + '</span>';
      card.appendChild(h);
      for (const t of list) card.appendChild(todoRow(t));
    }

    if (!anyOpen) {
      card.appendChild(el('div', 'mc-empty', lanes.done.length
        ? 'Tudo concluído. Dia limpo.'
        : 'Nenhuma tarefa. Adicione uma acima ou clique em Sincronizar.'));
    }

    if (lanes.done.length) {
      const tg = el('button', 'mc-done-toggle', (showDone ? 'esconder' : 'mostrar') + ' ' + lanes.done.length + ' concluída' + (lanes.done.length > 1 ? 's' : ''));
      tg.onclick = () => { showDone = !showDone; render(); };
      card.appendChild(tg);
      if (showDone) {
        for (const t of lanes.done.sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''))) card.appendChild(todoRow(t));
      }
    }
    return card;
  }

  // ---------- acoes ----------
  async function patch(id, body) {
    try { await api('PATCH', '/api/todo', { id, ...body }); await load(); }
    catch (e) { toast(e.message, true); }
  }
  async function remove(id) {
    try { await api('DELETE', '/api/todo?id=' + encodeURIComponent(id)); await load(); toast('descartada'); }
    catch (e) { toast(e.message, true); }
  }
  async function runIngest() {
    toast('sincronizando com o brain...');
    try {
      const r = await api('POST', '/api/mission/ingest', { days: 2 });
      await load();
      toast(r.added ? r.added + ' tarefa(s) nova(s)' : 'nada novo pra trazer');
    } catch (e) { toast(e.message, true); }
  }

  // ---------- cobranca no Asaas: formulario -> previa -> confirmacao ----------
  const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const ddmm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const STATUS_PT = { PENDING: 'Pendente', RECEIVED: 'Recebida', CONFIRMED: 'Confirmada', OVERDUE: 'Vencida' };
  function venceEm(iso) { const d = daysBetween(todayISO(), iso); return d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : 'vence em ' + d + ' dias'; }

  function closeCobranca() { const m = $('#mc-cob'); if (m) m.remove(); }

  function cobModal(html) {
    closeCobranca();
    const m = el('div', 'mc-modal');
    m.id = 'mc-cob';
    m.innerHTML = '<div class="mc-modal-box">' + html + '</div>';
    m.addEventListener('mousedown', e => { if (e.target === m) closeCobranca(); });
    $('#mc-root').appendChild(m);
    return m;
  }

  function ambBadge(amb) {
    return amb === 'producao'
      ? '<span class="mc-amb prod">PRODUÇÃO · cobrança real</span>'
      : '<span class="mc-amb">SANDBOX · teste, ninguém é cobrado</span>';
  }

  async function openCobranca(prev) {
    let st;
    try { st = await api('GET', '/api/asaas/status'); } catch (e) { return toast(e.message, true); }
    const m = cobModal('<div class="mc-modal-h">Nova cobrança ' + ambBadge(st.ambiente) + '</div>'
      + (st.temChave ? '<div class="mc-empty">carregando clientes do Asaas...</div>'
        : '<div class="mc-warn"><div>&#9888;</div><div><b>Sem chave do Asaas (' + esc(st.ambiente) + ').</b> '
          + 'Grave <code>ASAAS_API_KEY=...</code> em <code>' + (st.ambiente === 'producao' ? '~/.asaas.env' : '~/.asaas-sandbox.env')
          + '</code> pelo terminal e abra de novo.</div></div>'
          + '<div class="mc-modal-act"><button class="act" data-x>Fechar</button></div>'));
    m.querySelector('[data-x]') && (m.querySelector('[data-x]').onclick = closeCobranca);
    if (!st.temChave) return;

    let clientes;
    try { clientes = (await api('GET', '/api/asaas/clientes')).clientes; }
    catch (e) { closeCobranca(); return toast(e.message, true); }
    if (!$('#mc-cob')) return; // fechou enquanto carregava

    const v = prev || {};
    const opts = clientes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === v.customer ? ' selected' : '') + '>'
      + esc(c.name) + (c.email ? ' · ' + esc(c.email) : '') + '</option>').join('');
    const formas = st.formas.map(f => '<option value="' + f.v + '"' + (f.v === v.billingType ? ' selected' : '') + '>' + esc(f.label) + '</option>').join('');
    const box = $('#mc-cob .mc-modal-box');
    box.innerHTML = '<div class="mc-modal-h">Nova cobrança ' + ambBadge(st.ambiente) + '</div>'
      + '<form class="mc-form" autocomplete="off">'
      + '<label>Cliente (cadastrado no Asaas)<select name="customer" required><option value="">escolha...</option>' + opts + '</select></label>'
      + '<div class="mc-form-row">'
      + '<label>Valor (R$)<input name="value" inputmode="decimal" placeholder="1500,00" value="' + esc(v.value != null ? String(v.value).replace('.', ',') : '') + '" required></label>'
      + '<label>Vencimento<input name="dueDate" type="date" min="' + todayISO() + '" value="' + esc(v.dueDate || '') + '" required></label>'
      + '<label>Forma<select name="billingType">' + formas + '</select></label>'
      + '</div>'
      + '<label>Descrição (o cliente vê)<input name="description" maxlength="200" placeholder="Mensalidade novembro · Sistemas de IA" value="' + esc(v.description || '') + '" required></label>'
      + '<div class="mc-form-note">Limite por cobrança: ' + brl(st.valorMaximo) + '. Nada é criado nesta tela: o próximo passo é revisar.</div>'
      + '<div class="mc-modal-act"><button type="button" class="act" data-x>Cancelar</button><button type="submit" class="mc-primary">Revisar cobrança</button></div>'
      + '</form>';
    if (!clientes.length) box.querySelector('.mc-form-note').insertAdjacentHTML('beforebegin', '<div class="mc-warn"><div>&#9888;</div><div>Nenhum cliente cadastrado neste ambiente do Asaas.</div></div>');
    box.querySelector('[data-x]').onclick = closeCobranca;
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      const btn = e.target.querySelector('.mc-primary');
      btn.disabled = true; btn.textContent = 'conferindo...';
      try { showPrevia(await api('POST', '/api/asaas/previa', f), f); }
      catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Revisar cobrança'; }
    };
  }

  function showPrevia(pv, form) {
    const box = $('#mc-cob .mc-modal-box');
    if (!box) return;
    box.innerHTML = '<div class="mc-modal-h">Confirme a cobrança ' + ambBadge(pv.ambiente) + '</div>'
      + '<div class="mc-conf">'
      + '<div class="mc-conf-v">' + brl(pv.value) + '</div>'
      + '<dl><dt>Cliente</dt><dd>' + esc(pv.cliente.name) + (pv.cliente.email ? '<br><span>' + esc(pv.cliente.email) + '</span>' : '') + '</dd>'
      + '<dt>Vencimento</dt><dd>' + ddmm(pv.dueDate) + ' · ' + venceEm(pv.dueDate) + '</dd>'
      + '<dt>Forma</dt><dd>' + esc(pv.formaLabel) + '</dd>'
      + '<dt>Descrição</dt><dd>' + esc(pv.description) + '</dd></dl>'
      + '</div>'
      + '<div class="mc-form-note">' + (pv.ambiente === 'producao'
        ? 'Ao confirmar, o Asaas cria a cobrança e pode avisar o cliente por e-mail ou SMS, conforme a configuração da sua conta.'
        : 'Sandbox: a cobrança é criada no ambiente de teste do Asaas. Nenhum cliente real recebe nada.')
      + ' Esta confirmação vale 5 minutos e só pode ser usada uma vez.</div>'
      + '<div class="mc-modal-act"><button class="act" data-back>Voltar e editar</button>'
      + '<button class="mc-primary' + (pv.ambiente === 'producao' ? ' danger' : '') + '" data-ok>Confirmar e criar cobrança de ' + brl(pv.value) + '</button></div>';
    box.querySelector('[data-back]').onclick = () => openCobranca(form);
    const ok = box.querySelector('[data-ok]');
    ok.onclick = async () => {
      ok.disabled = true; ok.textContent = 'criando...';
      try { showCriada(await api('POST', '/api/asaas/confirmar', { token: pv.token })); }
      catch (err) { toast(err.message, true); ok.textContent = 'Falhou: revise de novo'; }
    };
  }

  function showCriada(r) {
    const box = $('#mc-cob .mc-modal-box');
    if (!box) return;
    box.innerHTML = '<div class="mc-modal-h">Cobrança criada ' + ambBadge(r.ambiente) + '</div>'
      + '<div class="mc-conf"><div class="mc-conf-v">' + brl(r.value) + '</div>'
      + '<dl><dt>Cliente</dt><dd>' + esc(r.cliente) + '</dd><dt>Vencimento</dt><dd>' + ddmm(r.dueDate) + '</dd>'
      + '<dt>ID no Asaas</dt><dd><code>' + esc(r.id) + '</code></dd><dt>Status</dt><dd>' + esc(STATUS_PT[r.status] || r.status) + '</dd></dl></div>'
      + '<div class="mc-form-note">Registrada em <code>state/cobrancas.jsonl</code>.</div>'
      + '<div class="mc-modal-act">'
      + (/^https:\/\//.test(r.invoiceUrl) ? '<a class="act" href="' + esc(r.invoiceUrl) + '" target="_blank" rel="noopener">Abrir fatura</a>' : '')
      + '<button class="mc-primary" data-x>Fechar</button></div>';
    box.querySelector('[data-x]').onclick = closeCobranca;
    toast('cobrança criada: ' + brl(r.value));
  }

  // ---------- cobrancas: visao so leitura (tecla C) ----------
  function cobLista(titulo, bloco, cls, quando) {
    const rows = bloco.itens.map(p => '<div class="mc-row">'
      + '<div class="mc-row-time' + cls + '">' + esc(quando(p)) + '</div>'
      + '<div class="mc-row-main"><div class="mc-row-t">' + esc(p.cliente) + ' · ' + brl(p.value) + '</div>'
      + '<div class="mc-row-s">' + esc(p.description || '(sem descrição)') + ' · ' + esc(p.billingType)
      + (p.invoiceUrl ? ' · <a href="' + esc(p.invoiceUrl) + '" target="_blank" rel="noopener">fatura</a>' : '') + '</div></div></div>').join('');
    return '<div class="mc-cob-sec"><div class="mc-cob-h">' + esc(titulo) + '<span>' + bloco.itens.length + ' · ' + brl(bloco.total) + '</span></div>'
      + (rows || '<div class="mc-empty">nada por aqui</div>') + '</div>';
  }

  async function openCobrancas() {
    if (!$('#mc-root').classList.contains('on')) open();
    const m = cobModal('<div class="mc-modal-h">Cobranças</div><div class="mc-empty">lendo o Asaas...</div>');
    m.querySelector('.mc-modal-box').classList.add('wide');
    let d;
    try { d = await api('GET', '/api/asaas/cobrancas'); }
    catch (e) {
      const box = $('#mc-cob .mc-modal-box');
      if (box) box.innerHTML = '<div class="mc-modal-h">Cobranças</div><div class="mc-warn"><div>&#9888;</div><div>' + esc(e.message) + '</div></div>'
        + '<div class="mc-modal-act"><button class="act" data-x>Fechar</button></div>';
      if (box) box.querySelector('[data-x]').onclick = closeCobranca;
      return;
    }
    const box = $('#mc-cob .mc-modal-box');
    if (!box) return;
    const atraso = p => { const n = daysBetween(p.dueDate, todayISO()); return n === 1 ? '1 dia' : n + ' dias'; };
    box.innerHTML = '<div class="mc-modal-h">Cobranças ' + ambBadge(d.ambiente).replace(/ · [^<]*/, '') + '</div>'
      + cobLista('Vencidas e não pagas', d.vencidas, ' late', atraso)
      + cobLista('A vencer', d.aVencer, '', p => ddmm(p.dueDate).slice(0, 5))
      + cobLista('Recebidas nos últimos 30 dias', d.recebidas, '', p => ddmm(p.paymentDate || p.dueDate).slice(0, 5))
      + '<div class="mc-form-note">Só leitura, direto do Asaas. Lido às ' + esc(d.geradoEm.slice(11, 16)) + '. Tecla C abre esta tela; Esc fecha.</div>'
      + '<div class="mc-modal-act"><button class="act" data-new>Nova cobrança</button><button class="mc-primary" data-x>Fechar</button></div>';
    box.querySelector('[data-x]').onclick = closeCobranca;
    box.querySelector('[data-new]').onclick = () => openCobranca();
  }

  // ---------- livro-caixa (opcional): visao so leitura (tecla L) ----------
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = ym => { const [a, m] = ym.split('-'); return MESES[Number(m) - 1] + ' de ' + a; };
  const somaMes = (ym, n) => { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

  function caixaLinha(l) {
    const sai = l.natureza === 'despesa';
    return '<div class="mc-row"><div class="mc-row-time">' + esc(ddmm(l.data).slice(0, 5)) + '</div>'
      + '<div class="mc-row-main"><div class="mc-row-t">' + esc(l.quem) + ' · <span class="mc-cx-' + (sai ? 'sai' : 'entra') + '">'
      + (sai ? '−' : '+') + brl(l.valor) + '</span></div>'
      + '<div class="mc-row-s">' + esc([l.categoria, l.forma, l.origem === 'agente' ? 'via agente' : '', l.obs].filter(Boolean).join(' · ')) + '</div></div></div>';
  }

  async function openCaixa(mes) {
    if (!$('#mc-root').classList.contains('on')) open();
    let box = $('#mc-cob .mc-modal-box');
    if (!box) { cobModal('<div class="mc-modal-h">Livro-caixa</div><div class="mc-empty">lendo o livro-caixa...</div>'); box = $('#mc-cob .mc-modal-box'); }
    box.classList.add('wide');
    let d;
    try { d = await api('GET', '/api/caixa' + (mes ? '?mes=' + mes : '')); }
    catch (e) {
      box.innerHTML = '<div class="mc-modal-h">Livro-caixa</div><div class="mc-warn"><div>&#9888;</div><div>' + esc(e.message) + '</div></div>'
        + '<div class="mc-modal-act"><button class="act" data-x>Fechar</button></div>';
      box.querySelector('[data-x]').onclick = closeCobranca;
      return;
    }
    const aviso = d.pendentesAgente
      ? '<div class="mc-warn"><div>&#9888;</div><div><b>' + d.pendentesAgente + (d.pendentesAgente === 1 ? ' lançamento' : ' lançamentos')
        + ' do agente esperando o seu ok.</b> Aparecem no próximo ritual de abertura do dia, ou peça ao Claude para lançar.</div></div>' : '';
    if (!d.existe) {
      box.innerHTML = '<div class="mc-modal-h">Livro-caixa</div>' + aviso
        + '<div class="mc-warn"><div>&#9888;</div><div>Livro-caixa não encontrado em <code>' + esc(d.arquivo) + '</code>.</div></div>'
        + '<div class="mc-modal-act"><button class="mc-primary" data-x>Fechar</button></div>';
      box.querySelector('[data-x]').onclick = closeCobranca;
      return;
    }
    const cats = d.porCategoria.map(([c, v]) => '<div class="mc-row"><div class="mc-row-main"><div class="mc-row-t">' + esc(c)
      + ' · ' + brl(v) + '</div></div></div>').join('');
    const primeiro = d.meses[0];
    box.innerHTML = '<div class="mc-modal-h mc-cx-top"><button class="act" data-prev title="mês anterior"' + (d.mes <= primeiro ? ' disabled' : '') + '>&#9666;</button>'
      + '<span>Livro-caixa · ' + esc(nomeMes(d.mes)) + '</span>'
      + '<button class="act" data-next title="próximo mês">&#9656;</button></div>'
      + aviso
      + '<div class="mc-cx-tot"><div><span>Entradas</span><b class="mc-cx-entra">' + brl(d.entradas) + '</b></div>'
      + '<div><span>Saídas</span><b class="' + (d.saidas > 0 ? 'mc-cx-sai' : '') + '">' + brl(d.saidas) + '</b></div>'
      + '<div><span>Saldo</span><b class="' + (d.saldo < 0 ? 'mc-cx-sai' : '') + '">' + brl(d.saldo) + '</b></div></div>'
      + (cats ? '<div class="mc-cob-sec"><div class="mc-cob-h">Despesas por categoria</div>' + cats + '</div>' : '')
      + '<div class="mc-cob-sec"><div class="mc-cob-h">Lançamentos do mês<span>' + d.lancamentos.length + '</span></div>'
      + (d.lancamentos.map(caixaLinha).join('') || '<div class="mc-empty">nada lançado neste mês</div>') + '</div>'
      + '<div class="mc-cob-sec"><div class="mc-cob-h">Últimos 10 lançamentos</div>'
      + (d.ultimos.map(caixaLinha).join('') || '<div class="mc-empty">livro-caixa vazio</div>') + '</div>'
      + '<div class="mc-form-note">Só leitura. Lançar é com o Claude ("lança R$ 89 do ChatGPT de hoje"), sempre com o seu ok. '
      + 'Recebimentos do Asaas entram quando lançados aqui. Tecla L abre esta tela; Esc fecha.</div>'
      + '<div class="mc-modal-act"><button class="act" data-cob>Cobranças</button><button class="mc-primary" data-x>Fechar</button></div>';
    box.querySelector('[data-x]').onclick = closeCobranca;
    box.querySelector('[data-cob]').onclick = () => { closeCobranca(); openCobrancas(); };
    box.querySelector('[data-prev]').onclick = () => openCaixa(somaMes(d.mes, -1));
    box.querySelector('[data-next]').onclick = () => openCaixa(somaMes(d.mes, 1));
  }

  // ---------- render ----------
  function render() {
    const inner = $('#mc-inner');
    if (!inner) return;
    const m = data.mission || { brief: {}, missing: true };
    inner.innerHTML = '';

    // topo
    const top = el('div', 'mc-top');
    const back = el('button', 'mc-back');
    back.innerHTML = '<span class="mc-back-arrow">&#9666;</span>'
      + '<div><div><span class="mc-back-name">Cara da IA</span><span class="mc-back-os">OS</span></div>'
      + '<div class="mc-back-sub">voltar pro grafo do cérebro</div></div>';
    back.onclick = close;
    top.appendChild(back);

    const right = el('div', 'mc-top-right');
    const now = new Date();
    const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const clock = el('div', 'mc-clock');
    clock.innerHTML = '<div class="mc-clock-d">' + String(now.getDate()).padStart(2, '0') + '/'
      + String(now.getMonth() + 1).padStart(2, '0') + '</div>'
      + '<div class="mc-clock-s">' + dias[now.getDay()] + '</div>';
    const bIng = el('button', 'act', 'Sincronizar');
    bIng.title = 'absorve a caixa de entrada do brain e as pendências dos diários recentes (não duplica, não apaga nada)';
    bIng.onclick = runIngest;
    const bRef = el('button', 'act', 'Atualizar');
    bRef.onclick = () => load().then(() => toast('atualizado'));
    const bCob = el('button', 'act', 'Nova cobrança');
    bCob.title = 'criar cobrança no Asaas, com revisão antes de enviar';
    bCob.onclick = () => openCobranca();
    const bVer = el('button', 'act', 'Cobranças');
    bVer.title = 'ver cobranças do Asaas (tecla C)';
    bVer.onclick = () => openCobrancas();
    const bCx = el('button', 'act', 'Livro-caixa');
    bCx.title = 'entradas, saídas e saldo do mês (tecla L)';
    bCx.onclick = () => openCaixa();
    right.appendChild(bCx); right.appendChild(bVer); right.appendChild(bCob); right.appendChild(bIng); right.appendChild(bRef); right.appendChild(clock);
    top.appendChild(right);
    inner.appendChild(top);

    // aviso quando o estado ainda nao foi escrito por nenhuma rotina
    if (m.missing) {
      inner.appendChild(el('div', 'mc-warn',
        '<div>&#9888;</div><div><b>O Morning Brief ainda não tem fonte.</b> Nenhuma rotina escreveu '
        + '<code>state/mission.json</code> ainda. Copie <code>state/mission.example.json</code> pra começar, '
        + 'ou rode a sua rotina de refresh. As tarefas abaixo funcionam normalmente.</div>'));
    }

    // To-do e Morning Brief, lado a lado. O to-do vem primeiro por ser o coracao.
    const cols = el('div', 'mc-cols');

    const cTodo = el('div');
    const openCount = data.todos.filter(t => t.status !== 'done').length;
    const hTodo = el('div', 'mc-h');
    hTodo.innerHTML = 'To-do<span class="mc-h-note">' + openCount + ' em aberto</span>';
    cTodo.appendChild(hTodo);
    cTodo.appendChild(renderTodos(data.todos));

    const cBrief = el('div');
    cBrief.appendChild(el('div', 'mc-h', 'Morning Brief'));
    cBrief.appendChild(renderBrief(m));

    cols.appendChild(cTodo);
    cols.appendChild(cBrief);
    inner.appendChild(cols);
  }

  async function load() {
    try {
      const j = await api('GET', API);
      data = j;
      loaded = true;
    } catch (e) {
      toast('não consegui ler o estado: ' + e.message, true);
    }
    render();
  }

  // ---------- abrir / fechar ----------
  function open() {
    if (window.Gestao) window.Gestao.fechar();
    const root = $('#mc-root');
    document.body.classList.add('mc-open');
    root.classList.add('on');
    window.__mcPaused = true;              // pausa o loop do grafo (economia de CPU)
    paintBackdrop();
    // forca o reflow e sobe a opacidade na hora. Nao usamos rAF aqui de proposito:
    // com a janela oculta o rAF nao dispara e o painel ficaria invisivel.
    void root.offsetHeight;
    root.classList.add('in');
    if (!loaded) render();                 // pinta a casca antes do fetch
    load().then(() => {
      const sc = $('#mc-scroll');
      if (sc) sc.scrollTop = 0;            // abre sempre do topo, depois do render
      const i = $('#mc-add-input');
      if (i) i.focus({ preventScroll: true });
    });
  }

  function close() {
    const root = $('#mc-root');
    root.classList.remove('in');
    document.body.classList.remove('mc-open');
    window.__mcPaused = false;
    setTimeout(() => root.classList.remove('on'), 240);
  }

  function toggle() { $('#mc-root').classList.contains('on') ? close() : open(); }

  // ---------- boot ----------
  addEventListener('DOMContentLoaded', () => {
    const root = el('div');
    root.id = 'mc-root';
    root.innerHTML = '<canvas id="mc-bg"></canvas><div id="mc-scroll"><div id="mc-inner"></div></div>';
    document.body.appendChild(root);

    const fab = el('button', 'fab', '◈ MISSION CONTROL');
    fab.id = 'fab-mission';
    fab.onclick = toggle;
    document.body.appendChild(fab);

    // Esc fecha o painel antes de o grafo tratar a tecla (capture)
    addEventListener('keydown', e => {
      const open = $('#mc-root').classList.contains('on');
      if (e.key === 'Escape' && open && $('#mc-cob')) {
        e.stopPropagation(); e.preventDefault(); closeCobranca(); return;
      }
      if (e.key === 'Escape' && open) {
        const drawer = document.getElementById('brain-viewer');
        if (drawer && drawer.classList.contains('open')) return; // deixa fechar o viewer primeiro
        e.stopPropagation(); e.preventDefault(); close(); return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (!typing && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); toggle(); }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault(); e.stopPropagation(); openCobrancas();
      }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault(); e.stopPropagation(); openCaixa();
      }
    }, true);

    const repaintIfOpen = () => { if ($('#mc-root').classList.contains('on')) paintBackdrop(); };
    addEventListener('resize', repaintIfOpen);
    // janela voltou de oculta: agora ha dimensao pra pintar o fundo
    document.addEventListener('visibilitychange', () => { if (!document.hidden) repaintIfOpen(); });
  });

  window.MissionControl = { open, close, toggle, load, openCobrancas, openCaixa: m => openCaixa(m), openCobranca: () => openCobranca(), get data() { return data; } };
})();
