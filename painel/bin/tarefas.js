#!/usr/bin/env node
/* tarefas.js - as tarefas do painel (tela Tarefas, tecla T) pela linha de comando.

   Lê e escreve o mesmo state/todos.json do painel, pelas funções do mission.js (escrita atômica
   e espelho em markdown). Leitura é livre. Escrita só roda com --confirmo: o agente só passa
   --confirmo depois do "pode" de quem manda.

     node bin/tarefas.js projetos                       # projetos e quantas tarefas abertas
     node bin/tarefas.js listar [PROJETO] [--todas]     # tarefas abertas (com --todas, as concluídas também)
     node bin/tarefas.js pendentes [--dias N]           # abertas atrasadas ou vencendo em N dias (padrão 0)
     node bin/tarefas.js criar "título" [--projeto NOME] [--prazo AAAA-MM-DD] [--descricao "..."]
                                        [--prioridade low|medium|high|urgent] --confirmo
     node bin/tarefas.js mover ID open|doing|done --confirmo
     node bin/tarefas.js concluir ID --confirmo
     node bin/tarefas.js criar-projeto "nome" --confirmo
     (leitura aceita --json; PROJETO é o nome, um pedaço dele ou o id)                              */
'use strict';
const path = require('path');
const M = require(path.join(__dirname, '..', 'mission.js'));

const a = process.argv.slice(2);
const cmd = a[0] || '';
const tem = f => a.includes(f);
const opcao = (nome, padrao) => { const i = a.indexOf(nome); return i >= 0 && a[i + 1] !== undefined ? a[i + 1] : padrao; };
const posicionais = () => { const out = []; for (let i = 1; i < a.length; i++) { if (a[i].startsWith('--')) { if (!['--todas', '--json', '--confirmo'].includes(a[i])) i++; continue; } out.push(a[i]); } return out; };
const sair = msg => { console.error(msg); process.exit(1); };
const exigirConfirmacao = () => { if (!tem('--confirmo')) sair('Escrita só com --confirmo, depois do "pode". Nada foi alterado.'); };
const ddmm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + (iso.slice(0, 4) !== M.today().slice(0, 4) ? '/' + iso.slice(2, 4) : '');
const NOMES = { open: 'a fazer', doing: 'fazendo', done: 'feito', snoozed: 'adiada' };

const store = M.readStore();
const nomeProj = id => { const p = store.projects.find(x => x.id === id); return p ? p.name : 'Sem projeto'; };
function acharProjeto(txt) {
  const s = M.slug(txt);
  const exato = store.projects.filter(p => p.id === txt || M.slug(p.name) === s);
  const achados = exato.length ? exato : store.projects.filter(p => M.slug(p.name).includes(s));
  if (!achados.length) sair('Projeto não encontrado: ' + txt + '. Veja: node bin/tarefas.js projetos');
  if (achados.length > 1) sair('Mais de um projeto casa com "' + txt + '": ' + achados.map(p => p.name).join(', '));
  return achados[0];
}
function linha(t) {
  const hoje = M.today();
  const prazo = t.due ? ddmm(t.due) + (t.status !== 'done' && t.due < hoje ? ' (atrasada)' : '') : 'sem prazo';
  return '- ' + t.id + ' | ' + nomeProj(t.project) + ' | ' + t.title + ' | ' + prazo + ' | ' + (NOMES[t.status] || t.status)
    + (t.priority === 'high' || t.priority === 'urgent' ? ' | ' + (t.priority === 'urgent' ? 'urgente' : 'alta') : '');
}
const porPrazo = (x, y) => (x.due || '9999').localeCompare(y.due || '9999');

if (cmd === 'projetos') {
  const ps = store.projects.map(p => ({ ...p, abertas: store.items.filter(t => t.project === p.id && t.status !== 'done').length }));
  if (tem('--json')) console.log(JSON.stringify(ps, null, 2));
  else { for (const p of ps) console.log(p.id + ' | ' + p.name + ' | ' + p.abertas + ' aberta(s)' + (p.archived ? ' | arquivado' : '')); console.log('\n' + ps.length + ' projeto(s)'); }
} else if (cmd === 'listar') {
  const alvo = posicionais()[0] ? acharProjeto(posicionais()[0]) : null;
  const ts = store.items.filter(t => (!alvo || t.project === alvo.id) && (tem('--todas') || t.status !== 'done')).sort(porPrazo);
  if (tem('--json')) console.log(JSON.stringify(ts.map(t => ({ ...t, projeto: nomeProj(t.project) })), null, 2));
  else { for (const t of ts) console.log(linha(t)); console.log('\n' + ts.length + ' tarefa(s)' + (alvo ? ' em ' + alvo.name : '')); }
} else if (cmd === 'pendentes') {
  const dias = Number(opcao('--dias', 0)) || 0;
  const d = new Date(M.today() + 'T12:00:00'); d.setDate(d.getDate() + dias);
  const limite = d.toISOString().slice(0, 10);
  const ts = store.items.filter(t => t.status !== 'done' && t.status !== 'snoozed' && t.due && t.due <= limite).sort(porPrazo);
  if (tem('--json')) console.log(JSON.stringify(ts.map(t => ({ ...t, projeto: nomeProj(t.project) })), null, 2));
  else {
    console.log('Tarefas do painel, ' + ddmm(M.today()) + ': ' + ts.length + ' com prazo até ' + ddmm(limite)
      + ' (' + store.items.filter(t => t.status !== 'done' && !t.due).length + ' aberta(s) sem prazo ficam de fora)');
    for (const t of ts) console.log(linha(t));
  }
} else if (cmd === 'criar') {
  exigirConfirmacao();
  const titulo = posicionais()[0];
  if (!titulo) sair('Faltou o título.');
  const prazo = opcao('--prazo');
  if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) sair('Prazo no formato AAAA-MM-DD.');
  const proj = opcao('--projeto') ? acharProjeto(opcao('--projeto')) : null;
  const t = M.addManual({ title: titulo, due: prazo || null, project: proj ? proj.id : null, notes: opcao('--descricao', ''), priority: opcao('--prioridade', 'medium'),
    origin: { label: opcao('--origem', 'Criada pelo agente') } });
  console.log('criada: ' + t.id + ' | ' + (proj ? proj.name : 'Sem projeto') + ' | ' + t.title + (t.due ? ' | prazo ' + ddmm(t.due) : ''));
} else if (cmd === 'mover' || cmd === 'concluir') {
  exigirConfirmacao();
  const [id, para] = posicionais();
  const status = cmd === 'concluir' ? 'done' : para;
  if (!id || !['open', 'doing', 'done'].includes(status)) sair('Uso: mover ID open|doing|done --confirmo  |  concluir ID --confirmo');
  try { const t = M.updateTodo(id, { status }); console.log(t.id + ' | ' + t.title + ' | agora: ' + NOMES[t.status]); }
  catch (e) { sair(e.message); }
} else if (cmd === 'criar-projeto') {
  exigirConfirmacao();
  try { const p = M.addProject({ name: posicionais()[0] }); console.log('projeto criado: ' + p.id + ' | ' + p.name); }
  catch (e) { sair(e.message); }
} else {
  console.log('Comandos: projetos | listar [PROJETO] [--todas] | pendentes [--dias N] | criar "título" [--projeto NOME] [--prazo AAAA-MM-DD] [--descricao "..."] --confirmo'
    + ' | mover ID open|doing|done --confirmo | concluir ID --confirmo | criar-projeto "nome" --confirmo');
  process.exit(cmd ? 1 : 0);
}
