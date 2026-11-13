/* _tarefas.js - tela Tarefas (tecla T): projetos e kanban, tudo guardado no próprio painel.

   Usa o mesmo armazenamento do Mission Control (state/todos.json): uma tarefa criada aqui aparece
   lá e vice-versa. As colunas são o status da tarefa (A fazer, Fazendo, Feito); o projeto é um
   rótulo. Arrastar muda o status; clicar abre a edição. Nada aqui fala com sistema externo. */
'use strict';
(function () {
  const COLUNAS = [{ id: 'open', t: 'A fazer' }, { id: 'doing', t: 'Fazendo' }, { id: 'done', t: 'Feito' }];
  const PRIOS = [['low', 'Baixa'], ['medium', 'Média'], ['high', 'Alta'], ['urgent', 'Urgente']];
  const PESO = { urgent: 0, high: 1, medium: 2, low: 3 };
  const FEITO_MAX = 30;

  let dados = null;
  let filtro = 'todos';          // 'todos' | 'sem' | id do projeto
  let verArquivados = false;
  let feitoTudo = false;
  let criandoProjeto = false;
  let arrastando = null;
  try { filtro = localStorage.getItem('tf-filtro') || 'todos'; } catch { }

  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // dia/mês; o ano só aparece quando não é o ano corrente
  const ddmm = iso => !iso ? '' : String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7)
    + (dados && dados.today && String(iso).slice(0, 4) !== dados.today.slice(0, 4) ? '/' + String(iso).slice(2, 4) : '');

  async function api(metodo, caminho, corpo) {
    const r = await fetch(caminho, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  function aviso(msg, erro) {
    let t = $('#tf-toast');
    if (!t) { t = el('div'); t.id = 'tf-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'on' + (erro ? ' erro' : '');
    clearTimeout(aviso._t); aviso._t = setTimeout(() => { t.className = ''; }, 2600);
  }
  async function fazer(fn, ok) {
    try { await fn(); await carregar(true); if (ok) aviso(ok); }
    catch (e) { aviso(e.message, true); await carregar(true); }
  }

  // ---------- leitura do estado ----------
  const projetos = () => (dados.projects || []).filter(p => verArquivados || !p.archived);
  const projeto = id => (dados.projects || []).find(p => p.id === id);
  function visiveis() {
    const arquivados = new Set((dados.projects || []).filter(p => p.archived).map(p => p.id));
    return dados.items.filter(t => {
      if (filtro === 'sem') return !t.project || !projeto(t.project);
      if (filtro !== 'todos') return t.project === filtro;
      return verArquivados || !arquivados.has(t.project);
    });
  }
  const colunaDe = t => t.status === 'done' ? 'done' : t.status === 'doing' ? 'doing' : 'open';
  function ordenar(lista, col) {
    if (col === 'done') return lista.sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || '')));
    return lista.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')
      || (PESO[a.priority] ?? 2) - (PESO[b.priority] ?? 2)
      || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  }

  // ---------- cartão ----------
  function cartao(t) {
    const hoje = dados.today;
    const c = el('div', 'tf-card' + (t.status === 'done' ? ' feito' : ''));
    c.draggable = true;
    c.dataset.id = t.id;
    const p = t.project && projeto(t.project);
    const bits = [];
    if (p && filtro === 'todos') bits.push('<span class="tf-tag"><i style="background:' + esc(p.color || '#808AFF') + '"></i>' + esc(p.name) + '</span>');
    if (t.due) {
      const cls = t.status === 'done' ? '' : t.due < hoje ? ' atrasada' : t.due === hoje ? ' hoje' : '';
      bits.push('<span class="tf-tag' + cls + '">' + (cls === ' atrasada' ? 'atrasada · ' : cls === ' hoje' ? 'hoje · ' : '') + ddmm(t.due) + '</span>');
    }
    if (t.priority === 'urgent' || t.priority === 'high') bits.push('<span class="tf-tag prio-' + t.priority + '">' + (t.priority === 'urgent' ? 'urgente' : 'alta') + '</span>');
    if (t.status === 'snoozed') bits.push('<span class="tf-tag">adiada' + (t.snooze_until ? ' até ' + ddmm(t.snooze_until) : '') + '</span>');
    if (t.needs_review) bits.push('<span class="tf-tag">conferir</span>');
    if (t.notes) bits.push('<span class="tf-tag" title="tem descrição">&#9776;</span>');
    c.innerHTML = '<button class="tf-check' + (t.status === 'done' ? ' on' : '') + '" title="' + (t.status === 'done' ? 'reabrir' : 'concluir') + '">' + (t.status === 'done' ? '&#10003;' : '') + '</button>'
      + '<div class="tf-card-main"><div class="tf-card-t">' + esc(t.title) + '</div>' + (bits.length ? '<div class="tf-card-m">' + bits.join('') + '</div>' : '') + '</div>';
    c.querySelector('.tf-check').onclick = e => {
      e.stopPropagation();
      fazer(() => api('PATCH', '/api/todo', { id: t.id, status: t.status === 'done' ? 'open' : 'done' }), t.status === 'done' ? 'tarefa reaberta' : 'tarefa concluída');
    };
    c.onclick = () => editar(t);
    c.ondragstart = e => { arrastando = t.id; c.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); };
    c.ondragend = () => { arrastando = null; c.classList.remove('arrastando'); document.querySelectorAll('.tf-col.alvo').forEach(n => n.classList.remove('alvo')); };
    return c;
  }

  // ---------- edição ----------
  function fecharModal() { const m = $('#tf-modal'); if (m) m.remove(); }
  function editar(t) {
    fecharModal();
    const m = el('div', 'mc-modal'); m.id = 'tf-modal';
    const ops = '<option value="">Sem projeto</option>' + (dados.projects || []).filter(p => !p.archived || p.id === t.project)
      .map(p => '<option value="' + esc(p.id) + '"' + (p.id === t.project ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const origem = t.origin && t.origin.label ? t.origin.label : '';
    m.innerHTML = '<div class="mc-modal-box wide"><div class="mc-modal-h">Tarefa</div><form class="mc-form">'
      + '<label>Título<input name="title" maxlength="300" required value="' + esc(t.title) + '"></label>'
      + '<div class="mc-form-row"><label>Projeto<select name="project">' + ops + '</select></label>'
      + '<label>Situação<select name="status">' + COLUNAS.map(c => '<option value="' + c.id + '"' + (colunaDe(t) === c.id ? ' selected' : '') + '>' + c.t + '</option>').join('') + '</select></label></div>'
      + '<div class="mc-form-row"><label>Prazo<input type="date" name="due" value="' + esc(t.due || '') + '"></label>'
      + '<label>Prioridade<select name="priority">' + PRIOS.map(([v, n]) => '<option value="' + v + '"' + ((t.priority || 'medium') === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div>'
      + '<label>Descrição<textarea name="notes" rows="7" maxlength="8000">' + esc(t.notes || '') + '</textarea></label>'
      + (origem ? '<div class="mc-form-note">Origem: ' + esc(origem) + (t.created_at ? ' · criada em ' + ddmm(t.created_at) : '') + '</div>' : '')
      + '<div class="mc-modal-act"><button type="button" class="act tf-excluir" data-del>Excluir</button><span class="tf-esp"></span>'
      + '<button type="button" class="act" data-x>Cancelar</button><button type="submit" class="mc-primary">Salvar</button></div></form></div>';
    document.body.appendChild(m);
    m.onclick = e => { if (e.target === m) fecharModal(); };
    m.querySelector('[data-x]').onclick = fecharModal;
    const del = m.querySelector('[data-del]');
    del.onclick = () => {
      if (!del.dataset.certeza) { del.dataset.certeza = '1'; del.textContent = 'Clique de novo para excluir'; return; }
      fecharModal();
      fazer(() => api('DELETE', '/api/todo?id=' + encodeURIComponent(t.id)), 'tarefa excluída');
    };
    m.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const patch = { id: t.id, title: f.get('title'), project: f.get('project') || null, due: f.get('due') || null, priority: f.get('priority'), notes: f.get('notes') };
      if (f.get('status') !== colunaDe(t)) patch.status = f.get('status');
      fecharModal();
      fazer(() => api('PATCH', '/api/todo', patch), 'tarefa salva');
    };
    m.querySelector('[name=title]').focus();
  }

  // ---------- render ----------
  function chips() {
    const linha = el('div', 'tf-chips');
    const abertas = id => dados.items.filter(t => t.status !== 'done' && (id === 'sem' ? (!t.project || !projeto(t.project)) : t.project === id)).length;
    const chip = (id, nome, n, cor, arq) => {
      const b = el('button', 'tf-chip' + (filtro === id ? ' on' : '') + (arq ? ' arq' : ''),
        (cor ? '<i style="background:' + esc(cor) + '"></i>' : '') + esc(nome) + ' <b>' + n + '</b>');
      b.onclick = () => { filtro = id; feitoTudo = false; try { localStorage.setItem('tf-filtro', id); } catch { } render(); };
      return b;
    };
    const arq = new Set((dados.projects || []).filter(p => p.archived).map(p => p.id));
    linha.appendChild(chip('todos', 'Todos', dados.items.filter(t => t.status !== 'done' && (verArquivados || !arq.has(t.project))).length));
    for (const p of projetos()) linha.appendChild(chip(p.id, p.name, abertas(p.id), p.color, p.archived));
    if (abertas('sem') || filtro === 'sem') linha.appendChild(chip('sem', 'Sem projeto', abertas('sem')));
    if (criandoProjeto) {
      const i = el('input', 'tf-novo-proj'); i.placeholder = 'Nome do projeto e Enter'; i.maxLength = 80;
      i.onkeydown = e => {
        if (e.key === 'Escape') { e.stopPropagation(); criandoProjeto = false; render(); }
        if (e.key === 'Enter' && i.value.trim()) {
          const nome = i.value.trim(); criandoProjeto = false;
          fazer(async () => { const r = await api('POST', '/api/projeto', { name: nome }); filtro = r.project.id; try { localStorage.setItem('tf-filtro', filtro); } catch { } }, 'projeto criado');
        }
      };
      linha.appendChild(i); setTimeout(() => i.focus(), 0);
    } else {
      const b = el('button', 'tf-chip mais', '+ Projeto');
      b.onclick = () => { criandoProjeto = true; render(); };
      linha.appendChild(b);
    }
    if (arq.size) {
      const b = el('button', 'tf-chip mais', verArquivados ? 'ocultar arquivados' : 'ver arquivados (' + arq.size + ')');
      b.onclick = () => { verArquivados = !verArquivados; if (!verArquivados && arq.has(filtro)) filtro = 'todos'; render(); };
      linha.appendChild(b);
    }
    return linha;
  }

  function barraProjeto(p) {
    const b = el('div', 'tf-proj');
    b.innerHTML = '<div class="tf-proj-n"><i style="background:' + esc(p.color || '#808AFF') + '"></i>' + esc(p.name) + (p.archived ? ' <span>arquivado</span>' : '') + '</div>'
      + '<div class="tf-proj-a"><button class="act" data-a="renomear">Renomear</button><button class="act" data-a="arquivar">' + (p.archived ? 'Desarquivar' : 'Arquivar') + '</button>'
      + '<button class="act tf-excluir" data-a="apagar">Apagar projeto</button></div>';
    b.querySelector('[data-a=renomear]').onclick = () => {
      const n = b.querySelector('.tf-proj-n');
      n.innerHTML = '<input class="tf-novo-proj" maxlength="80" value="' + esc(p.name) + '">';
      const i = n.querySelector('input'); i.focus(); i.select();
      i.onkeydown = e => {
        if (e.key === 'Escape') { e.stopPropagation(); render(); }
        if (e.key === 'Enter' && i.value.trim()) fazer(() => api('PATCH', '/api/projeto', { id: p.id, name: i.value.trim() }), 'projeto renomeado');
      };
    };
    b.querySelector('[data-a=arquivar]').onclick = () => {
      if (!p.archived) { verArquivados = false; filtro = 'todos'; }
      fazer(() => api('PATCH', '/api/projeto', { id: p.id, archived: !p.archived }), p.archived ? 'projeto de volta' : 'projeto arquivado');
    };
    const ap = b.querySelector('[data-a=apagar]');
    ap.onclick = () => {
      if (!ap.dataset.certeza) { ap.dataset.certeza = '1'; ap.textContent = 'Clique de novo (as tarefas ficam sem projeto)'; return; }
      filtro = 'todos';
      fazer(() => api('DELETE', '/api/projeto?id=' + encodeURIComponent(p.id)), 'projeto apagado');
    };
    return b;
  }

  function quadro() {
    const q = el('div', 'tf-board');
    const lista = visiveis();
    for (const col of COLUNAS) {
      const itens = ordenar(lista.filter(t => colunaDe(t) === col.id), col.id);
      const c = el('div', 'tf-col');
      c.innerHTML = '<div class="tf-col-h">' + col.t + ' <span>' + itens.length + '</span></div>';
      if (col.id !== 'done') {
        const add = el('input', 'tf-add');
        add.placeholder = '+ Nova tarefa e Enter'; add.maxLength = 300;
        add.onkeydown = e => {
          if (e.key !== 'Enter' || !add.value.trim()) return;
          const corpo = { title: add.value.trim(), status: col.id };
          if (filtro !== 'todos' && filtro !== 'sem') corpo.project = filtro;
          add.value = '';
          fazer(() => api('POST', '/api/todo', corpo), 'tarefa criada');
        };
        c.appendChild(add);
      }
      const corpo = el('div', 'tf-col-b');
      const mostra = col.id === 'done' && !feitoTudo ? itens.slice(0, FEITO_MAX) : itens;
      for (const t of mostra) corpo.appendChild(cartao(t));
      if (!itens.length) corpo.appendChild(el('div', 'mc-empty', col.id === 'done' ? 'nada concluído ainda' : 'vazio'));
      if (mostra.length < itens.length) {
        const mais = el('button', 'tf-chip mais', 'ver as outras ' + (itens.length - mostra.length));
        mais.onclick = () => { feitoTudo = true; render(); };
        corpo.appendChild(mais);
      }
      c.appendChild(corpo);
      c.ondragover = e => { if (arrastando) { e.preventDefault(); c.classList.add('alvo'); } };
      c.ondragleave = e => { if (!c.contains(e.relatedTarget)) c.classList.remove('alvo'); };
      c.ondrop = e => {
        e.preventDefault(); c.classList.remove('alvo');
        const id = arrastando || e.dataTransfer.getData('text/plain');
        const t = dados.items.find(x => x.id === id);
        if (!t || (colunaDe(t) === col.id && t.status !== 'snoozed')) return;
        fazer(() => api('PATCH', '/api/todo', { id, status: col.id }));
      };
      q.appendChild(c);
    }
    return q;
  }

  function render() {
    const inner = $('#tf-inner');
    if (!inner) return;
    const B = window.BRAND || {};
    inner.innerHTML = '';
    const top = el('div', 'mc-top');
    const back = el('button', 'mc-back', '<span class="mc-back-arrow">&#9666;</span><div><div><span class="mc-back-name">' + esc(B.nome || 'Cara da IA')
      + '</span><span class="mc-back-os">Tarefas</span></div><div class="mc-back-sub">voltar pro grafo do cérebro</div></div>');
    back.onclick = fechar;
    top.appendChild(back);
    const dir = el('div', 'mc-top-right');
    const bMc = el('button', 'act', 'Mission Control');
    bMc.onclick = () => { fechar(); window.MissionControl && window.MissionControl.open(); };
    const bAt = el('button', 'act', 'Atualizar');
    bAt.onclick = () => carregar();
    dir.appendChild(bMc); dir.appendChild(bAt);
    top.appendChild(dir);
    inner.appendChild(top);
    if (!dados) { inner.appendChild(el('div', 'mc-empty', 'lendo as tarefas...')); return; }
    if (filtro !== 'todos' && filtro !== 'sem' && !projetos().some(p => p.id === filtro)) filtro = 'todos';
    inner.appendChild(chips());
    if (filtro !== 'todos' && filtro !== 'sem') inner.appendChild(barraProjeto(projeto(filtro)));
    inner.appendChild(quadro());
  }

  async function carregar(quieto) {
    if (!quieto && !dados) render();
    try { dados = await api('GET', '/api/tarefas'); }
    catch (e) { aviso(e.message, true); }
    if (estaAberta()) render();
  }

  // ---------- abrir / fechar ----------
  function abrir(projetoId) {
    if (window.MissionControl) window.MissionControl.close();
    if (window.Gestao) window.Gestao.fechar();
    const root = $('#tf-root');
    document.body.classList.add('mc-open', 'tf-open');
    root.classList.add('on');
    window.__mcPaused = true;
    void root.offsetHeight;
    root.classList.add('in');
    if (projetoId) filtro = projetoId;
    render();
    carregar();
  }
  function fechar() {
    const root = $('#tf-root');
    if (!root.classList.contains('on')) return;
    fecharModal();
    root.classList.remove('in');
    document.body.classList.remove('tf-open');
    if (!document.querySelector('#mc-root.on') && !document.querySelector('#gs-root.on')) { document.body.classList.remove('mc-open'); window.__mcPaused = false; }
    setTimeout(() => root.classList.remove('on'), 240);
  }
  const estaAberta = () => $('#tf-root').classList.contains('on');

  addEventListener('DOMContentLoaded', () => {
    const root = el('div');
    root.id = 'tf-root';
    root.innerHTML = '<div id="tf-scroll"><div id="tf-inner"></div></div>';
    document.body.appendChild(root);
    const fab = el('button', 'fab', '☑ TAREFAS');
    fab.id = 'fab-tarefas';
    fab.onclick = () => estaAberta() ? fechar() : abrir();
    document.body.appendChild(fab);
    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape' && estaAberta()) {
        const drawer = document.getElementById('brain-viewer');
        if (drawer && drawer.classList.contains('open')) return;
        e.stopPropagation(); e.preventDefault();
        if ($('#tf-modal')) return fecharModal();
        if (digitando) return document.activeElement.blur();
        fechar(); return;
      }
      if (!digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault(); e.stopPropagation(); estaAberta() ? fechar() : abrir();
      }
    }, true);
  });

  // atalhos do app instalado: /?abrir=tarefas|mission|gestao
  addEventListener('load', () => setTimeout(() => {
    const alvo = new URLSearchParams(location.search).get('abrir');
    if (alvo === 'tarefas') abrir();
    else if (alvo === 'mission' && window.MissionControl) window.MissionControl.open();
    else if (alvo === 'gestao' && window.Gestao) window.Gestao.abrir();
  }, 300));

  window.Tarefas = { abrir, fechar };
})();
