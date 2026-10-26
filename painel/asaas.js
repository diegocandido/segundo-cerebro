/* asaas.js - criar cobranca no Asaas a partir do Mission Control.

   Unica escrita permitida: POST /payments (criar cobranca). Nao existe codigo
   para cancelar, estornar, editar ou transferir, de proposito.

   Fluxo em duas etapas, pra nada sair num clique so:
     1. previa(dados)   valida tudo, confere o cliente no Asaas e devolve um
                        token de confirmacao de uso unico (vale 5 minutos);
     2. confirmar(tok)  so entao cria a cobranca e registra em state/cobrancas.jsonl.

   Ambiente vem de config/asaas.json ("sandbox" por padrao). Producao so liga
   editando esse arquivo a mao; o painel nao tem como trocar.
   Chaves fora do repo: ~/.asaas-sandbox.env (sandbox) e ~/.asaas.env (producao),
   cada uma com a linha ASAAS_API_KEY=... A chave nunca vai pro navegador.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const M = require('./mission');

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};
const ENV_FILES = {
  sandbox: path.join(os.homedir(), '.asaas-sandbox.env'),
  producao: path.join(os.homedir(), '.asaas.env'),
};
const FORMAS = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', UNDEFINED: 'Cliente escolhe' };
const LOG_FILE = path.join(M.STATE_DIR, 'cobrancas.jsonl');
const TOKEN_TTL = 5 * 60 * 1000;
const pendentes = new Map(); // token -> { payload, cliente, exp }

function cfg() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'asaas.json'), 'utf8')); } catch { }
  const ambiente = c.ambiente === 'producao' ? 'producao' : 'sandbox';
  const formas = (Array.isArray(c.formas) ? c.formas : ['PIX', 'BOLETO', 'UNDEFINED']).filter(f => FORMAS[f]);
  return { ambiente, valorMaximo: Number(c.valorMaximo) > 0 ? Number(c.valorMaximo) : 20000, formas };
}

// Teste local: ASAAS_TESTE_URL aponta pra um Asaas simulado, so em sandbox e so em 127.0.0.1
function base(ambiente) {
  const t = process.env.ASAAS_TESTE_URL;
  if (t && ambiente === 'sandbox' && /^http:\/\/127\.0\.0\.1:\d+\/?/.test(t)) return t.replace(/\/+$/, '');
  return BASES[ambiente];
}

function chave(ambiente) {
  try {
    for (const linha of fs.readFileSync(ENV_FILES[ambiente], 'utf8').split(/\r?\n/)) {
      if (linha.startsWith('ASAAS_API_KEY=')) {
        const v = linha.slice('ASAAS_API_KEY='.length).trim();
        if (v) return v;
      }
    }
  } catch { }
  return null;
}

async function chamar(method, caminho, body) {
  const { ambiente } = cfg();
  const escritaOk = method === 'POST' && caminho === '/payments';
  if (method !== 'GET' && !escritaOk) throw new Error('recusado: ' + method + ' ' + caminho);
  const teste = base(ambiente) !== BASES[ambiente];
  const key = teste ? 'teste-local' : chave(ambiente);
  if (!key) throw new Error('sem chave do Asaas (' + ambiente + '): grave ASAAS_API_KEY em ' + ENV_FILES[ambiente].replace(os.homedir(), '~'));
  const r = await fetch(base(ambiente) + caminho, {
    method,
    headers: { access_token: key, accept: 'application/json', 'content-type': 'application/json', 'User-Agent': 'os-mission-control' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.errors || []).map(e => e.description).join('; ') || ('HTTP ' + r.status);
    throw new Error('Asaas: ' + msg);
  }
  return j;
}

function status() {
  const c = cfg();
  const teste = base(c.ambiente) !== BASES[c.ambiente];
  return { ambiente: c.ambiente, temChave: teste || !!chave(c.ambiente), valorMaximo: c.valorMaximo,
    formas: c.formas.map(v => ({ v, label: FORMAS[v] })) };
}

async function clientes() {
  const out = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const j = await chamar('GET', '/customers?limit=100&offset=' + offset);
    for (const c of j.data || []) if (!c.deleted) out.push({ id: c.id, name: c.name, email: c.email || '' });
    if (!j.hasMore) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function previa(dados) {
  const c = cfg();
  const erros = [];
  const customer = String(dados.customer || '');
  const value = Math.round(Number(String(dados.value || '').replace(',', '.')) * 100) / 100;
  const dueDate = String(dados.dueDate || '');
  const billingType = String(dados.billingType || '');
  const description = String(dados.description || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const hoje = M.today();

  if (!/^cus_[A-Za-z0-9]+$/.test(customer)) erros.push('escolha o cliente');
  if (!(value >= 5)) erros.push('valor mínimo é R$ 5,00');
  if (value > c.valorMaximo) erros.push('valor acima do limite de R$ ' + c.valorMaximo.toLocaleString('pt-BR') + ' (config/asaas.json)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < hoje) erros.push('vencimento tem que ser hoje ou depois');
  else if (dueDate > addDays(hoje, 365)) erros.push('vencimento a mais de um ano');
  if (!c.formas.includes(billingType)) erros.push('forma de pagamento não permitida');
  if (!description) erros.push('descreva a cobrança (aparece para o cliente)');
  if (erros.length) throw new Error(erros.join(' · '));

  // confere no Asaas que o cliente existe, e usa o nome de la (nao o do navegador)
  const cli = await chamar('GET', '/customers/' + customer);
  if (!cli || cli.deleted) throw new Error('cliente não encontrado no Asaas');

  for (const [t, p] of pendentes) if (p.exp < Date.now()) pendentes.delete(t);
  const token = crypto.randomUUID();
  const payload = { customer, billingType, value, dueDate, description };
  pendentes.set(token, { payload, cliente: { name: cli.name, email: cli.email || '' }, exp: Date.now() + TOKEN_TTL });
  return { token, ambiente: c.ambiente, cliente: { name: cli.name, email: cli.email || '' },
    value, dueDate, billingType, formaLabel: FORMAS[billingType], description, expiraEm: TOKEN_TTL / 1000 };
}

async function confirmar(token) {
  const p = pendentes.get(String(token || ''));
  pendentes.delete(String(token || '')); // uso unico, mesmo se falhar: refaz a previa
  if (!p) throw new Error('confirmação inválida ou já usada: revise de novo');
  if (p.exp < Date.now()) throw new Error('a prévia expirou (5 min): revise de novo');
  const { ambiente } = cfg();
  const r = await chamar('POST', '/payments', p.payload);
  const reg = { created_at: M.nowISO(), ambiente, id: r.id, cliente: p.cliente.name, customer: p.payload.customer,
    value: r.value, dueDate: r.dueDate, billingType: r.billingType, description: p.payload.description,
    invoiceUrl: r.invoiceUrl || '', status: r.status };
  fs.mkdirSync(M.STATE_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, JSON.stringify(reg) + '\n');
  return reg;
}

/* Visao das cobrancas, so leitura: vencidas, a vencer e recebidas nos ultimos
   30 dias. O nome do cliente vem do cadastro, porque /payments so traz o id. */
async function listarCobrancas() {
  const desde = addDays(M.today(), -30);
  const pegar = q => chamar('GET', '/payments?limit=100&' + q).then(j => j.data || []);
  const [vencidas, aVencer, recebidas, confirmadas, cli] = await Promise.all([
    pegar('status=OVERDUE'),
    pegar('status=PENDING'),
    pegar('status=RECEIVED&paymentDate%5Bge%5D=' + desde),
    pegar('status=CONFIRMED&paymentDate%5Bge%5D=' + desde),
    clientes(),
  ]);
  const nome = Object.fromEntries(cli.map(c => [c.id, c.name]));
  const fmt = p => ({ id: p.id, cliente: nome[p.customer] || p.customer, value: p.value,
    dueDate: p.dueDate, paymentDate: p.paymentDate || p.clientPaymentDate || null,
    billingType: FORMAS[p.billingType] || p.billingType, description: p.description || '',
    status: p.status, invoiceUrl: /^https:\/\//.test(p.invoiceUrl || '') ? p.invoiceUrl : '' });
  const soma = l => Math.round(l.reduce((s, p) => s + (Number(p.value) || 0), 0) * 100) / 100;
  const v = vencidas.map(fmt).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const a = aVencer.map(fmt).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const r = [...recebidas, ...confirmadas].map(fmt).sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
  return { ambiente: cfg().ambiente, geradoEm: M.nowISO(), desde,
    vencidas: { itens: v, total: soma(v) }, aVencer: { itens: a, total: soma(a) }, recebidas: { itens: r, total: soma(r) } };
}

function recentes(n = 8) {
  try {
    return fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean)
      .map(l => JSON.parse(l)).slice(-n).reverse();
  } catch { return []; }
}

module.exports = { status, clientes, previa, confirmar, recentes, listarCobrancas };
