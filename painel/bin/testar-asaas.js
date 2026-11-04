#!/usr/bin/env node
/* testar-asaas.js: confere se a chave do Asaas gravada funciona. Só lê, não cria nada.

     node painel/bin/testar-asaas.js            sandbox (padrão)
     node painel/bin/testar-asaas.js producao   conta real

   Roda de dentro do kit ou da cópia do painel: não depende de config nenhuma. Lê a chave do
   arquivo (~/.asaas-sandbox.env ou ~/.asaas.env), chama a API do Asaas e mostra o nome da conta
   e quantos clientes e cobranças ela tem. Nunca mostra a chave. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const amb = process.argv[2] === 'producao' ? 'producao' : 'sandbox';
const BASE = amb === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
const ARQ = path.join(os.homedir(), amb === 'producao' ? '.asaas.env' : '.asaas-sandbox.env');
const grava = 'zsh painel/bin/gravar-chave-asaas.sh' + (amb === 'sandbox' ? ' sandbox' : '');

let chave = '';
try {
  for (const l of fs.readFileSync(ARQ, 'utf8').split(/\r?\n/)) if (l.startsWith('ASAAS_API_KEY=')) chave = l.slice(14).trim();
} catch { }
if (!chave) { console.log('FALTA: nenhuma chave em ' + ARQ.replace(os.homedir(), '~') + '\n  -> o cliente grava pelo terminal: ' + grava); process.exit(1); }

const get = async rota => {
  const r = await fetch(BASE + rota, { headers: { access_token: chave, accept: 'application/json', 'User-Agent': 'os-instalacao' }, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'chave recusada pelo Asaas (401): gere outra em Integrações e grave de novo' : 'Asaas respondeu HTTP ' + r.status + ((j.errors && j.errors[0]) ? ': ' + j.errors[0].description : ''));
  return j;
};

(async () => {
  try {
    const conta = await get('/myAccount/commercialInfo').catch(() => ({}));
    const cli = await get('/customers?limit=1');
    const cob = await get('/payments?limit=1');
    console.log('ASAAS OK (' + amb + ')');
    if (conta.name || conta.companyName) console.log('  conta: ' + (conta.companyName || conta.name));
    console.log('  clientes cadastrados: ' + (cli.totalCount ?? '?'));
    console.log('  cobranças: ' + (cob.totalCount ?? '?'));
  } catch (e) {
    console.log('FALHOU (' + amb + '): ' + e.message);
    process.exit(1);
  }
})();
