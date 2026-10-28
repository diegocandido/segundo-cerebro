/* Livro-caixa (opcional): leitura do CSV do livro-caixa para o Mission Control (tecla L).
   Só leitura. Quem lança é o Claude, pelo bin/livro_caixa.py do segundo cérebro, depois do ok do
   dono. O CSV fica fora da pasta do segundo cérebro de propósito: não vai para backup nem para
   um agente remoto. Caminhos em config/workspace.json -> missionControl.livroCaixa e
   missionControl.agenteFinanceiroDir (relativos ao segundo cérebro). */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./scan');
const M = require('./mission');

const ARQUIVO = path.resolve(ROOT, M.mcOpt('livroCaixa') || '../Financeiro/livro-caixa.csv');
const INBOX_AGENTE = path.resolve(ROOT, M.mcOpt('agenteFinanceiroDir') || 'inbox/agente/financeiro');

// CSV do Python (delimitador ";", aspas quando o campo tem ; ou quebra de linha).
function parseCSV(txt) {
  const rows = []; let row = []; let f = ''; let q = false;
  txt = txt.replace(/^﻿/, '');
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"' && txt[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}

function lancamentos() {
  if (!fs.existsSync(ARQUIVO)) return null;
  const [cab, ...linhas] = parseCSV(fs.readFileSync(ARQUIVO, 'utf8'));
  return linhas.map((l, i) => {
    const r = Object.fromEntries(cab.map((k, j) => [k, l[j] || '']));
    const [d, m, a] = r['Data'].split('/');
    return {
      ordem: i, data: `${a}-${m}-${d}`, mes: `${a}-${m}`, natureza: r['Natureza'], quem: r['Quem'],
      categoria: r['Categoria'], valor: Number(String(r['Valor']).replace(',', '.')) || 0,
      forma: r['Forma'], origem: r['Origem'], obs: r['Observação'],
    };
  });
}

function pendentesAgente() {
  let n = 0;
  try {
    for (const f of fs.readdirSync(INBOX_AGENTE)) {
      if (!f.endsWith('.md')) continue;
      const t = fs.readFileSync(path.join(INBOX_AGENTE, f), 'utf8');
      if (/^tipo: lancamento-financeiro$/m.test(t) && /^status: pendente$/m.test(t)) n++;
    }
  } catch { /* pasta ausente: zero */ }
  return n;
}

function resumo(mesPedido) {
  const todos = lancamentos();
  if (todos === null) return { existe: false, arquivo: ARQUIVO, pendentesAgente: pendentesAgente() };
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const mes = /^\d{4}-\d{2}$/.test(mesPedido || '') ? mesPedido : mesAtual;
  const doMes = todos.filter(l => l.mes === mes).sort((a, b) => b.data.localeCompare(a.data) || b.ordem - a.ordem);
  const soma = nat => doMes.filter(l => l.natureza === nat).reduce((s, l) => s + l.valor, 0);
  const entradas = soma('recebimento'); const saidas = soma('despesa');
  const porCategoria = {};
  for (const l of doMes) if (l.natureza === 'despesa') porCategoria[l.categoria || 'sem categoria'] = (porCategoria[l.categoria || 'sem categoria'] || 0) + l.valor;
  const meses = [...new Set([mesAtual, ...todos.map(l => l.mes)])].sort();
  return {
    existe: true, mes, meses, entradas, saidas, saldo: entradas - saidas,
    porCategoria: Object.entries(porCategoria).sort((a, b) => b[1] - a[1]),
    lancamentos: doMes,
    ultimos: [...todos].sort((a, b) => b.data.localeCompare(a.data) || b.ordem - a.ordem).slice(0, 10),
    pendentesAgente: pendentesAgente(),
  };
}

module.exports = { resumo };
